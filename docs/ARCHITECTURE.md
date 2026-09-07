# Runtime architecture and engineering notes

## Ownership and dependency graph

The application uses native ES modules. `main.js` owns lifecycle, fixed-step
scheduling, input, scene replacement, UI integration and persistence entry points.
No package is required at runtime.

```text
main.js ────── UI / browser input / CameraRig / RailAudio
   │
   ├────────── RailwayWorld ───── RailNetwork ───── TrackEdge
   │                 │                                 │
   │                 └──── geometry batches            │
   │                                                   │
   ├────────── Train ───────────────────────────── RailCursor
   │             │
   ├────────── Traffic / Mission
   │
   ├────────── RollingStockRenderer ── dynamic geometry batches
   │
   └────────── Renderer ── WebGPU or WebGL 2
```

`data.js` is authored world, stock, scenario and weather configuration. `math.js`
is the shared deterministic math/noise/matrix layer. `persistence.js` defines the
versioned interchange boundary. `shaders.js` contains native WGSL and equivalent
GLSL ES material/lighting implementations. Rendering reads train state; it does
not advance the simulation.

## Coordinate and buffer contracts

World coordinates use metres, +Y up and train-local +Z forward. Rail distances are
metres along sampled arc length. Speed is signed metres/second; force newtons;
mass kilograms; power watts; time seconds. UI speed can be km/h or mph. Matrices
are column-major with column vectors. The right-handed perspective function has
explicit WebGPU [0,1] and WebGL [-1,1] depth variants.

Each static vertex occupies 32 bytes: position float3, normal float3, UV float2.
Indices are uint32. Each instance occupies 96 bytes: model matrix float4x4, tint
float4 and material-parameter float4. Vertex attributes 0–2 address geometry;
3–8 address per-instance fields. Normal transformation accounts for nonuniform
scale in the instance basis; general shears are not authored.

The shared frame UBO is 352 bytes: three matrices followed by ten float4 fields.
The matrices are view-projection, inverse view-projection and light view-projection.
Remaining fields encode camera/time, sun/day, sun/exposure, fog, environment,
headlight position/intensity, headlight direction/shadow enable, terrain color,
rock color, and viewport/snow/wind. WGSL and GLSL layouts match this contract.

## Railway geometry and path history

Each world starts with a closed Catmull-Rom alignment, sampled at approximately
three-metre resolution. Cumulative segment lengths are stored in Float64Array.
`TrackEdge.at(s)` performs a binary search and interpolates the sample position
and orientation; rolling stock is therefore driven by actual distance rather
than by spline parameter or elapsed animation time.

The default network has four edges: approach, main, branch and return. A turnout
chooses main or branch at the approach exit; both paths rejoin return. Spatial
queries use a hash grid followed by successively refined local sampling.
`RailCursor` retains a bounded path history. A coach sampling a negative offset
uses the edge actually traversed by its locomotive, not the switch's current
state. Positive and negative movement cross edge boundaries explicitly.

Vehicle placement samples rail at both bogies, derives a chord frame and places
the body between them. This produces train alignment and pitch on the sampled
route. It does not implement independent suspension travel, track irregularity
spectra or individual wheel contacts.

Custom editor alignments replace the loop control points but retain the fixed
main/branch topology. This is not an arbitrary directed railway graph editor.
Cursor restore validates edge identities and adjacency to reject inconsistent
history. History is bounded, so very long reverse travel beyond retained history
cannot reproduce every historic turnout decision indefinitely.

## Fixed-step driving model

The frame loop accumulates elapsed time, applies the selected time scale and
integrates at 1/60 second. Catch-up is bounded and visibility/pause transitions
clear stale time. An overloaded browser may advance simulation time more slowly
rather than integrate a large unstable timestep. This is intentionally not a
wall-clock timetable simulation.

For signed speed v, total consist mass M and direction r, the approximate driving
balance is:

```text
Ftraction = r · min(Frequested, Pavailable / max(|v|, vMinimum), μ · Mdriven · g)
Fgrade    = -Σ(Mvehicle · g · gradientAtVehicle)
Fresist   = rollingResistance(|v|, M, stock) + Fbrake
M · dv/dt = Ftraction + Fgrade - sign(v) · Fresist
```

The actual implementation also handles zero-speed static holding, sign changes,
traction lag, interlocks, low-speed dynamic-brake fade and brake adhesion caps.
Davis-like resistance combines mass-scaled rolling terms with stock-specific
quadratic drag. Adhesion changes with weather; sanding increases the available
coefficient. Motor demand beyond available adhesion is reflected in wheel slip.
These authored coefficients are for gameplay, not measured rolling-stock fits.

A single train object owns signed speed and longitudinal acceleration; cars are
geometrically spaced along its path. Their mass contributes to train dynamics.
The displayed coupler force is an aggregate inertial estimate, not a force from
a solved chain of spring/damper couplers. Longitudinal slack and independent car
velocities are not simulated.

### Pneumatic and other brakes

The brake pipe is expressed in bar, charging toward 5 bar. Commands move pressure
at finite rates. Per-vehicle normalized cylinder states respond progressively
along the consist; service and emergency modes use different deceleration scales.
Train, independent, dynamic and parking contributions are summed and limited by
adhesion. Emergency cuts traction immediately rather than waiting for throttle
lag to decay. Master, doors, pantograph and available supply can inhibit traction.

This is an approximation of propagation and brake response, not a compressible
fluid pipe network or a complete distributor-valve model. Pipe state, cylinders,
reservoir, throttle lag and door animation progress are included in saves.

### Steam and energy

Steam stock has water, boiler, fire and regulator behavior. Diesel/steam stock
consume a simplified fuel state. Mechanical energy is integrated and the electric
model accounts for an approximate dynamic-braking energy recovery term. These
values are operational feedback, not a utility-grade electrical or thermodynamic
accounting model.

### Overspeed and train contact

Local curvature sets a speed constraint and lateral acceleration estimate.
Excessive sustained lateral acceleration disables the train and applies emergency
braking. Occupancy intervals also detect overlapping consists on the same edge.
Contact stops and secures the involved trains. No collision impulse, derailment
trajectory, deformation or overturning rigid-body simulation is computed.

## Dispatch and missions

Traffic occupancy is independent of rendered meshes. A 400 m block map tracks
sets of train IDs. Intervals cover each occupied edge of a consist; block updates
sample the train at no more than approximately 8 m spacing. Look-ahead queries
produce red/yellow/green aspects and danger distance. Manual holds join the same
braking decision path. Reverse danger checks inspect ahead of the rear of the
consist. A turnout is locked in the approach/fouling zone.

AI controllers set the same master, reverser, brake and traction fields as manual
drivers. Their target speed combines line/curve limits, braking distance to an
occupied block and approach to a station. An AI station dwell lasts 18 seconds.
The recently served station is retained until the train has physically departed,
preventing immediate repeated dwell at the same marker.

Player passenger calls require low speed, alignment within 18 m and open doors
for 20 seconds. Missed stations and excessive speed affect scores; three completed
stops finish the service. Passenger counts are deterministic gameplay quantities,
not individually simulated people. Precision uses this same service engine.
Freight completion checks the destination marker at low speed rather than a full
shunting or coupling workflow.

## Renderer

Initialization prefers a WebGPU adapter in a secure context. Shader compilation
messages and asynchronous pipeline creation are checked before the renderer is
selected. Initialization failure destroys the partial device, replaces a canvas
already bound to a WebGPU context where needed, and attempts WebGL 2. Complete
backend failure shows an actionable fatal message. Device/context loss is
reported; full automatic restoration is not implemented.

Rendering passes are:

```text
visible-instance selection / foliage LOD
    ↓
directional-light depth map (optional)
    ↓
procedural sky fullscreen triangle
    ↓
opaque instanced geometry + procedural surface shading
    ↓
alpha-blended particles (depth-tested, no depth writes)
    ↓
present / optional screenshot
```

WebGPU uses four-sample MSAA, depth32float, a 1536-pixel directional shadow map,
explicit bind-group layouts and cached geometry/instance GPU buffers. WebGL 2
uses equivalent instanced attributes, a uniform block and comparison depth
texture. Shader material families cover terrain, water, glass, emissive surfaces,
vegetation, architectural surfaces, ballast and particles.

Lighting is physically inspired rather than a complete calibrated PBR pipeline:
roughness/metallic controls, a GGX-like highlight, hemispheric ambient, procedural
sun/sky illumination and tone mapping. Water and glass reflect the procedural
sky, not the full scene. There is no ray tracing, SSR, global illumination or
screen-space ambient occlusion. The alpha pass is ordered after opaque geometry
but is not a full per-particle, depth-sorted transparency solution.

Terrain is partitioned into chunks. Static repeated objects are grouped by
geometry/material and spatial cells. Batches carry conservative bounding spheres,
frustum/distance culling and vegetation near/far LOD flags. Fine conifers switch
to lower-triangle coarse models. Dynamic trains, signals and weather use reused
instance storage. World replacement disposes world-owned GPU resources but keeps
shared primitive meshes. Geometry construction is cooperative on the main
thread, not a worker-streamed terrain pipeline.

Quality controls modify visibility/LOD and render resolution. An adaptive option
lowers resolution after sustained slow frames. DPR is capped. These mechanisms
reduce load; they do not establish any guaranteed mobile frame rate.

## Persistence, editing and lifecycle

The project format is JSON with `format: "railbound-adventures"`, `version: 2`.
It contains world ID, editor state, environment, graphics/driving settings,
player/AI train snapshots, scenario/mission, switch state, signal holds, autopilot,
simulation clock and camera state. The generator seed and edit commands recreate
geometry; GPU buffers are not serialized.

Validation bounds list lengths and coordinates, checks known world/stock IDs and
cursor connectivity, clamps numeric state, and rejects malformed topology. The
file picker rejects files larger than 3 MB. User-visible imported text is escaped.
There is no eval or code execution in the project format.

World creation validates a candidate train/network before committing the new
world; old rendering resources are then disposed. Editor changes are staged with
undo/redo. Applying a changed railway rebuilds geometry, maps the player to nearby
rail, secures it at rest and removes AI trains whose old path histories are no
longer reliable. Editor undo is not general simulation rewind.

Autosaves are local to the browser and export is explicit. Storage failure is
handled without preventing play. The service worker, when installed from a secure
source-root deployment, only caches same-origin application assets. There is no
account, telemetry, multiplayer or server-side persistence.

## Extension priorities

For broader simulation fidelity, the existing boundaries support a general rail
node/edge graph, route reservations and interlocking, physically modeled couplers,
per-car dynamics, actual timetable data, worker-based scene generation, geographic
asset ingestion and richer locomotive system plugins. None of these unimplemented
extensions is needed for the supplied runnable game, and none is claimed to be
present merely because the architecture can accommodate it.

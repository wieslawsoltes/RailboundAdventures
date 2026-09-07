# Cinematic Journeys — version 3.1

This release builds on Expeditions without changing its seeded route topology or
terrain generation revision. It adds a linear-light display pipeline, corrects
visible geometry defects, and adds optional audio, wildlife and driving tools.
The runtime remains dependency-free HTML/CSS/JavaScript.

## Rendering contract

`PostProcessor` owns all screen-size-dependent display targets. WebGPU renders
into a four-sample `rgba16float` attachment and resolves into a linear scene
texture. Four fullscreen-triangle passes extract soft-knee highlights at quarter
resolution, blur horizontally and vertically, then composite bloom and apply one
filmic display transform. Linear lighting is not tonemapped independently per
material. Grading includes four looks, exposure, saturation/contrast/temperature,
a vignette and optional grain. Grain defaults to zero. Contrast preserves positive low-light values rather than subtracting a black offset, and night ambient light keeps train silhouettes legible. The low preset and zero
bloom setting skip extraction and both blur passes.

WebGL 2 queries `EXT_color_buffer_float`. With float targets it follows the same
linear pipeline; multisample count is the intersection supported by the actual
color/depth renderbuffer formats, capped at four. Without float renderability,
the scene uses an RGBA8 compatibility target with bloom disabled and avoids a
second tonemap. Render attachments never alias simultaneously sampled textures.
All target textures, framebuffers and renderbuffers are released on resize.
Dimensions are capped proportionally to texture limits, including portrait.

Main lighting now uses roughness-dependent GGX visibility and a Fresnel-based
energy split. Moving procedural cloud coverage modulates direct sunlight.
Northern night skies include a moon and an animated aurora. The sky remains an
analytic procedural approximation, not path tracing or volumetric cloud tracing.
Transparent batches are sorted back-to-front; triangle-level transparent sorting
is not performed. The same scene renderers are used in driving and photo mode.

## Geometry and nature

The Velocity 320 has a smooth superelliptical loft with glazing placed on the
surface. The coarse chassis no longer extends underneath the entire tapered
nose. Legacy flat windscreen/cab-frame assemblies are interior-only; high-speed
trains no longer use front furniture intended for flat-front locomotives.

Bridge decks, vertical piers, bearings and arch springings now share one span
subdivision. Piers do not tilt with the track grade. Foundation pads sample a
rotated nine-point building footprint; ordinary town houses reject extreme
slopes instead of hovering or growing arbitrary towers underneath them. These
are visual civil-engineering approximations, not structural designs.

Shore foam follows marching-square water intersections on the eroded heightfield
rather than a circular stencil. Edited relief is resampled for shoreline
construction. Flocks use deterministic paths, wing animation, instanced geometry,
camera-distance culling and a 12/32/80-bird quality budget. Wildlife can be turned
off without affecting the simulation. Wildlife is scenic, not ecological AI.

Track-adjacent terrain cells subdivide to five-metre triangles, with conforming
transition edges into coarse cells. This fixes the numerical-field/render-mesh
mismatch that could bury the cab in a deep cutting. Camera collision samples the
actual rendered triangles and lifts its boom instead of collapsing it into a
coach. Loading-gauge clearance and shared-edge topology have dedicated tests.
High-speed cab framing follows the nose loft; roof equipment stops before the
taper and the nose has a closed end cap.

## Driving and sound

The read-only journey director samples the selected route ahead. Its service
stopping estimate combines speed, gradient, wet adhesion and train-length brake
propagation; it presents upcoming curves, signals and mission stops. It does not
operate the train or replace automatic train protection. Stopping advice is an
estimate, not a safety guarantee. A route panel shows elevation, posted limits
and the estimated braking-distance band. Statistics record distance, time,
overspeed exposure, harsh driving, traction energy and station door openings.
The score is transparent: time-weighted overspeed and harshness penalties.

Train audio has continuous motor harmonics, rail noise, speed-dependent wind,
brake noise, flange squeal, distance-triggered rail joints, rain, occasional bird
calls and a three-tone horn. A master compressor limits summed transients. The
graph has a fixed voice/node budget rather than allocating nodes per frame.
Audio starts only after a user gesture; reduced-motion camera and environmental
audio controls are independent. Sound is synthesized, not recorded locomotive
sound-pack fidelity. Audio graph execution is tested; perceptual listening and
physical-device latency are not certified by browser automation.

## Controls and persistence

Open **Settings → Graphics & immersion** or **Journey → Display & immersion**.
The **Studio** button or **F2** enters photo mode, pauses the simulation, hides the
HUD and switches to free camera. Drag to look; WASD moves, Q/E changes altitude,
and Shift increases movement speed. Lens, exposure and grading controls affect
the renderer. Capture saves an actual canvas PNG, not the HTML interface.
**Escape** or **Exit** restores the preceding camera mode, field of view and
pause state. Driving shortcuts cannot change train controls during photo mode.
Chosen grade and exposure are retained. Photo mode is not offline path tracing.

**Journey** opens telemetry. Its statistics and display/comfort settings round
trip through project JSON. Existing saves remain valid; version-2 geography
migration and the generator version remain unchanged. The offline shell includes
all new modules. No data is transmitted to a service by these features.

## Validation

`npm test` runs original mathematical/physics/generation/rolling-stock checks and
new cinematic regressions. The new suite covers display options, size limits,
shader entry points, route-advisory non-interference, stopping-distance behavior,
teleport rejection, telemetry scoring, loft/cab geometry, foundations, bridge
alignment, wildlife budgets, shoreline contours, audio mapping, camera collision
and persistence/offline module coverage.

`tools/verify_cinematic.py` runs the real candidate modules through WebGPU and
WebGL 2, checks GPU validation, actual screenshot pixels, grading differences,
bloom pass budgets, resize resource counts, photo controls/PNG capture, audio
node counts, mobile layouts, save restoration, night/rain scenes, offline worker
startup and a forced no-float WebGL compatibility context. The pre-existing
Expedition matrix continues to cover all eight regions and six train families.

Run locally after installing the pinned browser test dependencies from the CI
workflow:

```sh
npm test
npm run build:pages
python3 -m http.server 8000
# In a second terminal; on Linux WebGPU use xvfb-run and Vulkan dependencies.
PAGE_URL=http://localhost:8000/ BACKEND=webgpu xvfb-run -a python3 tools/verify_cinematic.py
```

Software GPU runs validate API, shaders, presentation and behavior. They are not
native GPU performance measurements, physical-phone qualification, or proof of
AAA production parity. Screen-space reflections, temporal antialiasing,
photogrammetry, skeletal people, arbitrary multi-line railway generation and
multiplayer are not implemented in this release.

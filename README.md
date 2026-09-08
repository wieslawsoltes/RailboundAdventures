# Railbound Adventures

## Material & Lighting Fidelity — v3.3

Eight bundled CC0 material sets supply sRGB base color plus linear normal/roughness/occlusion maps. Near-field architecture adds matching window frames, shop awnings, ground-conforming paving and street furniture. The renderer adds three stabilized shadow ranges, half-resolution ambient contact shading, sky-specular response and view-dependent window-room parallax. Use **Display & immersion** to compare surface maps, normal mapping and contact shading.

See [rendering and asset contracts](docs/FIDELITY.md). The standalone build embeds the maps; the module build serves them locally. No third-party runtime download, API key or renderer framework is required.

## Living Worlds — denser nature and coherent neighbourhoods

Version 3.2 adds branch-and-leaf forest canopies, three vegetation LODs, streamed grass/ferns/wildflowers, connected street graphs, buildable parcels, parks, regional skylines and metre-scaled facade materials. See [Living Worlds architecture and validation](docs/LIVING-WORLDS.md). New regions are available from **Worlds → Survey & enter**.

## Cinematic Journeys

Version 3.1 adds linear HDR rendering, soft bloom, four display looks, an interactive photo studio, a route-based driving coach and saved journey telemetry. Terrain-grounded foundations and aligned viaduct spans address visible world defects; the Velocity 320 gains a smooth lofted nose with surface glazing. Scenic bird flocks, shoreline foam, northern night lighting and layered synthesized rail audio add atmosphere. Display, wildlife, sound and reduced-motion controls are optional.

Use **Studio / F2** for photo mode or **Journey** for route guidance. See [Cinematic architecture, controls and validation](docs/CINEMATIC-JOURNEYS.md) for the rendering contract and explicit boundaries.

## Expeditions: procedural worlds and detailed trains

Version 3 replaces the shared circular geography with eight seeded regional terrain models, erosion, drainage-aware ecology, surveyed asymmetric routes, regional landmarks and scenic viewpoints. Trains gain cached mechanical assemblies, detailed wheel profiles, suspension, roof equipment and cab geometry with distance-based detail levels. Existing version-2 saves keep their original geography.

Open **Worlds** to choose a seed, adjust relief, vegetation and erosion, then **Survey & enter**. See [Expedition architecture, controls and validation](docs/EXPEDITIONS.md) for implementation details and explicit boundaries.

**[Play in your browser](https://wieslawsoltes.github.io/RailboundAdventures/)** · [Deployment workflow](https://github.com/wieslawsoltes/RailboundAdventures/actions/workflows/pages.yml)

An original, dependency-free browser railway sandbox and driving game. Native
WebGPU rendering is implemented directly, with a WebGL 2 compatibility renderer.
The simulation is driven by fixed-step train dynamics, not pre-scripted movement.
Terrain, rolling stock, buildings, vegetation and sounds are generated locally.
Eight CC0 surface-map pairs are bundled with the application, with source and
derived hashes. No runtime CDN, API keys, renderer frameworks or backend
services are required. Normal builds never contact the asset provider.

![Actual desktop render](docs/preview-desktop.png)

## Run

**Single file:** open `dist/index.html` in a browser. The separately supplied
`Railbound-Adventures.html` is the same self-contained build. Some mobile file
previewers do not execute HTML applications; use an actual browser and a local or
HTTPS static server instead.

**Source modules, recommended for development:**

```sh
cd railbound-adventures
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. On Windows, `run.bat` uses the Python launcher or
`python`; on macOS/Linux, `sh run.sh` starts the same server. Python is only a
convenient static server, not part of the game runtime. Node.js is optional and
only used by the test commands.

The renderer prefers WebGPU where an adapter and compatible secure context are
available. Otherwise it attempts WebGL 2. Use HTTPS for a remotely accessed or
mobile-hosted deployment. Plain HTTP to a computer's LAN IP does not generally
qualify as a secure WebGPU origin. Localhost is treated differently. See the
[MDN WebGPU reference](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
and [secure-context guide](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

The source-root deployment includes a manifest and versioned service worker for
offline app-shell caching after an initial successful visit. The standalone HTML
has no service-worker dependency. Browser storage is optional: project files can
be exported even when localStorage is unavailable.

## First departure

Press **Begin your journey**. This closes the doors, switches on the master,
raises the pantograph, selects forward, releases the brakes and applies moderate
power. Brake pressure takes time to recharge. Adjust power with **W/S** and the
train brake with **D/A**, or use the two large touch sliders. Drag the scene to
look around; scroll or pinch to zoom. **C** cycles six cameras; **1** selects the
cab. **Space** applies the emergency brake.

The tools on the right open Worlds, Fleet, Environment, Map, Dispatch, World
Editor and Setup. The instrument deck opens the advanced locomotive controls.
Setup also contains save/import, graphics quality, train recovery and units.
The in-game help lists all controls. See [docs/CONTROLS.md](docs/CONTROLS.md).

## Included systems

| Area | Implemented behavior |
| --- | --- |
| Railway | Arc-length sampled Catmull-Rom track; main circuit and selectable branch; 1.435 m visual gauge; sleepers, ballast, bridges, overhead wires and platforms. |
| Train dynamics | Fixed 60 Hz integration; consist mass; force- and power-limited traction; gradient and drag; wheel adhesion, wheel slip and sanding; progressive air-brake pressure; dynamic, independent, parking and emergency brakes; reverse and rollback. |
| Locomotive controls | Master, reverser, throttle, brakes, doors, pantograph, lights, wipers, horn, fuel/water and simplified steam fire/boiler controls. Traction and door interlocks affect movement. |
| Traffic | 400 m occupancy blocks; red/yellow/green signals; manual signal holds; turnout approach locking; AI services with station stops; automatic speed/signal protection; train-contact detection and recovery. |
| Play | Free roam, passenger calls, freight delivery and a precision-driving challenge; station alignment, 20-second boarding dwell, scores and stop logs. Precision uses the passenger-service engine, not a separate career system. |
| World control | Eight seeded route themes; six weather settings; editable hour, time rate and exposure; scenery placement; terrain brushes; station placement; custom closed-loop track nodes; electrification and seed; staged undo/redo. |
| Fleet control | Six original train families; configurable consist size and resulting mass; stop-only stock changes; AI creation/removal/takeover; stopped-train repositioning on clear track. |
| Rendering | Procedural terrain and materials; sun/sky/clouds/stars; directional shadow mapping; glass and water sky reflections; headlights and emissive windows; vegetation LOD, instancing and frustum/distance culling; weather and steam particles. |
| Cameras/input | Cab, chase, orbit, aerial, trackside and free flight; keyboard/mouse, touch drag/pinch and standard gamepad mapping; responsive portrait/landscape HUD. |
| Persistence | Validated JSON projects; browser autosaves; route/editor, train, pressure, controls, traffic holds, camera, weather and mission progress restoration. |
| Audio | Procedural motor, rolling noise and horn through Web Audio, enabled by user interaction. |

## Worlds

The locations and railway layouts are fictional, geographically inspired
procedural environments, not surveyed reproductions or downloadable real maps.
Each default route is a looping railway with a branch and five named stations.
Changing the seed regenerates scenery and route details within its theme.

| World | Character |
| --- | --- |
| Alpine Crossing | Mountain lake, snow-capped massif, conifer forests and elevated sections. |
| Pacific Coast | Ocean cliffs, coastal towns and bridges. |
| Nordic Fjords | Steep fjord landscape, snow and reduced adhesion. |
| Canyon Trails | Layered red rock, sparse vegetation and heavy-freight terrain. |
| Sakura Valley | Blossom trees, fields, villages and a faster electrified route. |
| Highland Wanderer | Moorland, loch, stone structures and heritage driving. |
| Pine Valley | Gentle woodland railway and small towns. |
| Neon Metropolis | Elevated urban railway, towers and illuminated windows. |

## Rolling stock

| Train | Type | Nominal maximum power | Stock speed ceiling |
| --- | --- | ---: | ---: |
| Aurora E200 | Electric intercity | 4.2 MW | 200 km/h |
| Velocity 320 | High-speed set | 8.0 MW | 320 km/h |
| Atlas D90 | Diesel freight | 2.9 MW | 120 km/h |
| Heritage Pacific | Steam excursion | 1.7 MW | 120 km/h |
| Metro M8 | Electric commuter | 2.4 MW | 120 km/h |
| Ranger DMU | Regional diesel | 1.1 MW | 160 km/h |

These are fictional authored parameters, not measured real-locomotive data. A
stock's maximum speed is not permission to reach that speed on every route: line
and curvature limits apply. The fastest default line limit is 220 km/h, and
individual curves can impose substantially lower limits.

## Develop and test

```sh
npm test                 # Node's built-in test runner; no npm install required
python3 tools/build.py   # Rebuild the dependency-free standalone distribution
```

`tools/build.py` recursively resolves this project's explicit named ES-module
imports. It preserves each module in an isolated closure, inlines CSS and the SVG
icon, and emits `dist/index.html`, `dist/app.bundle.js`, and a single-file HTML in
the parent directory. This is a deliberately scoped bundler, not a general
replacement for a JavaScript build system.

Browser integration tests use the optional Python Playwright package and an
installed Chromium. See [docs/TESTING.md](docs/TESTING.md) for the actual test
conditions, exact checks and important unverified paths. No testing dependencies
are loaded by the game.

The runtime is available as `globalThis.railbound` for inspection:

```js
railbound.togglePause(true);
console.table(railbound.trains.map(t => ({
  id: t.id,
  stock: t.stock.name,
  massKg: t.mass,
  speedKmh: t.speed * 3.6
})));
const project = railbound.projectSnapshot();
await railbound.importProject(project);
```

Adding a world or locomotive starts in `src/data.js`. The renderer is not tied to
the DOM control layer, and physics tests do not require a browser or GPU. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for coordinate conventions, rendering
contracts, physics equations, persistence and extension points.

## Scope and limitations

This delivery is a playable procedural 3D railway sandbox with substantial
working systems. It is **not feature-complete parity with a commercial train
simulator**, a certified training model or a photogrammetric reconstruction.
The art is procedural and visibly stylized rather than AAA photorealistic.

Dynamics are one-dimensional along the railway. Cars follow actual route history,
but coupler slack, suspension, wheel/rail contact geometry and off-rail rigid-body
crashes are not solved as full multibody dynamics. Excessive lateral acceleration
or train contact disables and brakes a train; it does not produce a physically
deformed crash. Steam, adhesion and braking are useful approximations, not
manufacturer-validated equipment models.

The railway editor supports closed loops with the built-in branch topology, not
an arbitrary rail-network construction system. Signaling is a simplified block
system, not a certified implementation of ETCS, PZB, AWS or a national rulebook.
There is no multiplayer, downloaded real-world geography, asset marketplace,
licensed fleet, full timetable/career economy, walkable passenger simulation,
seamless regional streaming or comprehensive operational failure catalog.

The native WebGPU code path is implemented but was **not exercised on a secure,
native-GPU browser in the delivery environment**. WebGL 2 rendering and gameplay
were exercised in Chromium using a software GPU. Phone-sized layouts and touch
controls were tested through browser emulation, not physical iOS/Android devices.
Physical gamepads, audio hardware, offline service-worker behavior and thermal
performance also need target-device validation. No frame-rate guarantee is made.

## License and privacy

MIT; see LICENSE. The game makes no analytics or third-party API requests.
Projects remain in browser-local storage unless explicitly exported. The service
worker requests only same-origin application files. No external fonts, images,
models or recorded audio are bundled.

## GitHub Pages deployment

Pushes to `main` run the core tests, rebuild the standalone game, validate the
static app-shell asset graph and deploy `_site/` to GitHub Pages. Pull requests
run the same verification without publishing. All runtime paths are relative
and support the `/RailboundAdventures/` project subdirectory. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for details.

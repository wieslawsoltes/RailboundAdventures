# Railbound Adventures

**[Play in your browser](https://wieslawsoltes.github.io/RailboundAdventures/)** · [Deployment workflow](https://github.com/wieslawsoltes/RailboundAdventures/actions/workflows/pages.yml)

A browser railway sandbox and driving game in plain HTML, CSS and JavaScript.
The renderer uses WebGPU directly, with a WebGL 2 compatibility path. Train physics
runs at fixed 60 Hz; movement, brakes, gradients and controls are simulated rather
than scripted. Runtime libraries and third-party CDNs are not required.

## Art & Motion — 3.4

This upgrade adds a curated CC0 library of six mossy rocks, a stump and four fern
models with three levels of detail each. Pine-twig imagery improves nearby conifer
foliage. Source and derived hashes, artist credits and conversion settings are
included. The assets are served locally and embedded in the standalone game.

Stations gain curved platform canopies, structural trusses, purlins, columns,
regional wings and glazed concourses. Coaches gain smooth manufactured shells,
rounded window seals and glazing while retaining working doors, wheels and controls.

High/Ultra HDR adds camera-reprojected temporal antialiasing with variance clipping,
reactive-object rejection and two explicitly owned history targets. Low/Medium and
WebGL without floating-point render targets retain spatial rendering. Use
**Display & immersion → Temporal antialiasing** to toggle it. Camera-only temporal AA
is not per-object motion vectors, temporal upscaling or a guarantee against every
foliage artifact.

[Art, memory, rendering and build contracts](docs/ART-AND-MOTION.md)

## Run locally

```sh
git clone https://github.com/wieslawsoltes/RailboundAdventures.git
cd RailboundAdventures
npm start
```

Open `http://localhost:8000`. `npm start` uses Python 3's static HTTP server; no npm
packages are needed to run or build the game. `run.sh` and `run.bat` provide alternative
launchers. Node 22+ is used for the regression suite.

```sh
npm test
npm run build:pages
```

The build validates all imports, asset paths, hashes, PWA scope and offline entries.
It emits the project-subdirectory-safe website in `_site/`, a self-contained edition
at `dist/index.html`, and readable `dist/app.bundle.js`. The single-file edition embeds
the bundled surface maps, authored textures and mesh pack; its size is intentional.
The build also writes `Railbound-Adventures.html` beside the repository directory.

WebGPU needs a compatible browser, hardware acceleration and a secure context
(HTTPS or localhost). Host the mobile version over HTTPS. Ordinary HTTP at another
computer's LAN address is not localhost. Unsupported WebGPU falls back to WebGL 2;
no-float WebGL uses the LDR compatibility path. Mobile layout emulation is not a
substitute for testing on physical phones.

## Drive

Press **Begin your journey** to configure departure. **W/S** adjusts power,
**D/A** adjusts the train brake, **Space** applies emergency braking, **C** cycles
cameras, and **1** selects the cab. Touch sliders expose the same driving controls.
Use **Studio / F2** for photo mode and **Journey** for route guidance and telemetry.
Photo mode pauses the simulation, isolates driving shortcuts and restores the
previous camera and pause state on exit. Screenshots capture actual rendered pixels.

[Complete controls](docs/CONTROLS.md) · [Architecture](docs/ARCHITECTURE.md)

## Explore and edit

Eight fictional regions have different terrain models, ecology, landmarks and scenic
railway alignments: Alpine, Pacific Coast, Nordic, Canyon, Sakura, Highland, Pine and
Metropolis. Choose a region and seed through **Worlds → Survey & enter**. Relief,
ecology and erosion settings affect generation. **Version-2 saves preserve their old
geography**; generate a fresh world to see the newer landscapes and station kit.

The world editor places scenery/stations, edits relief, changes electrification and
accepts custom closed-loop alignments. Staged edits support undo/redo and rebuild the
simulated railway when applied. Project JSON import/export is validated; browser
storage provides local save/restore. The service worker precaches runtime modules,
textures and authored geometry for offline reload after successful installation.

Six fictional train families cover electric intercity, high-speed, diesel freight,
steam excursion, electric commuter and regional diesel operation. Consist mass affects
traction and braking. Available systems include adhesion and sanding, gradients,
longitudinal resistance, progressive air-brake response, independent/dynamic/parking/
emergency brakes, doors, reverser, master power, lights, horn, wipers and simplified
steam/fuel controls. AI traffic, block occupancy, selectable turnout, signals,
manual signal holds, protection, station dwell and passenger/freight activities remain
independent of visual effects. Journey guidance is advisory, not a braking guarantee.

## Rendering and prior upgrades

**Material & Lighting Fidelity 3.3:** eight bundled CC0 surface sets, signed triplanar
normal mapping, mipmapped anisotropic arrays, three stabilized shadow ranges,
world-radius screen-space ambient occlusion, analytical sky specular response,
view-dependent window-room shading and instanced architectural details.
[Details](docs/FIDELITY.md)

**Living Worlds 3.2:** dense branch/leaf forests, three vegetation levels, streamed
understory, connected streets, parcels, mixed-height districts, parks, avenue trees,
façade materials and shaped parked vehicles. [Details](docs/LIVING-WORLDS.md)

**Cinematic Journeys 3.1:** linear HDR, multisample rendering, soft bloom, four grades,
photo studio, telemetry, camera comfort controls, synthesized environmental audio,
bird flocks, shoreline foam, night atmosphere and corrected railway structures.
[Details](docs/CINEMATIC-JOURNEYS.md)

**Expeditions 3.0:** domain-warped terrain, bounded hydraulic/thermal erosion, drainage,
climate-dependent ecology, terrain-aware asymmetric railway circuits, worker generation
and detailed mechanical train assemblies. [Details](docs/EXPEDITIONS.md)

## Verification and scope

Core tests cover simulation, geometry, deterministic generation, project validation,
asset integrity, renderer contracts and resource ownership. Browser workflows exercise
WebGPU and WebGL, all regions and trains, rendering changes, real driving controls,
mobile layouts, offline reload and the single-file build. Art & Motion additionally
reads actual HDR scene/history data to test reactive-object and disocclusion behavior.
Pages deployment compares every published runtime file byte-for-byte with its build.

Check the current [Actions results](https://github.com/wieslawsoltes/RailboundAdventures/actions)
for the exact candidate or published revision; a historical passing run is not proof of
a newer commit. Screenshots and machine-readable reports are retained as CI artifacts.
[Testing guide](docs/TESTING.md)

This remains a procedural sandbox, not complete commercial train-simulator or AAA
art parity. The curated art library is small; landscapes and most architecture/rolling
stock are procedural. Window rooms are shader illusions, not enterable interiors.
There is no ray tracing, dynamic global illumination, multiplayer, surveyed real routes,
animated road traffic or full wheel/rail multibody derailment physics. The connected
railway operating model is not an arbitrary multi-line network editor. Software-GPU
checks establish correctness, not native GPU performance or physical-device support.

## Licensing

Original source is [MIT licensed](LICENSE). Bundled ambientCG surfaces and Poly Haven
natural assets use CC0-1.0; their separate licenses, credits and provenance manifests
are in `assets/materials/` and `assets/authored/`. Acquisition/conversion tools are
explicit offline steps, not startup dependencies. meshoptimizer 1.2.0 is a build-time
MIT-licensed simplifier and is not part of the game runtime.

# Expedition generation · version 3

This release replaces the shared elliptical railway / radial lake bowl with eight
independently designed regional corridors and a reproducible landscape pipeline.
It also adds close-range mechanical rolling-stock geometry. No downloaded models,
textures, dependencies or external services are required by the game.

## Generate and explore

Open **Worlds**, choose a numerical seed (or Shuffle), set Mountain relief,
Ecological density and Erosion strength, then choose **Survey & enter** on a region.
The relief-map previews are computed from that seed, not illustrative photographs.
They show the pre-erosion field and coarse surveyed control polygon; the final
railway uses the eroded field and spline interpolation. Export your current project
before replacing its world. Generation controls are saved in project JSON.

The two **Explore** buttons move the free camera to the region's landmark and
watershed overlook. They do not move the train. Drag to look, use WASD / Q / E to fly,
and C to return to a train camera. These viewpoints also work with touch look input.

| Region | Geometry and ecological identity | Constructed landmarks |
| --- | --- | --- |
| Alpine Crossing | Domain-warped ridges, tributary meltwater channels, snowline and conifer forest | Masonry viaducts, high-country cabins, avalanche fences, conditional waterfalls |
| Pacific Coast | An open ocean edge with headlands, coves and offshore stacks | Steel-braced bridges, breakwater, lighthouse |
| Nordic Fjords | Main fjord with branching inlets, steep granite walls and low snowline | Cabins, avalanche fences, boats, waterfalls where slope permits |
| Canyon Trails | Incised river, terraced sandstone mesas and sparse cactus / juniper scrub | Truss bridges, hoodoos, walk-through sandstone arch |
| Sakura Valley | Isolated volcanic cone and crater, lowland river, cherry / bamboo woodland | Five-tier temple and rice terraces |
| Highland Wanderer | Elongated lochs, drumlins, heather / birch / pine mosaics | Ruined keep with curtain walls and crenellations |
| Pine Valley | A meandering watershed with wooded ridges and moist understory | Sawmill, log piles and millwheel |
| Neon Metropolis | Tidal channels and low urban terraces | Port cranes, container stacks, boats and existing illuminated towers |

## Numerical terrain and railway survey

`TerrainField` is independent of the renderer and DOM. Named integer-seeded random
streams drive the macro field, erosion, route survey and ecological placement.
The pipeline consists of domain-warped multi-octave noise, theme-specific landforms,
five conservative thermal-transport passes, up to 9,000 hydraulic droplets with
bounded lifetimes, D8 downhill flow accumulation, and moisture/slope/temperature
sampling. Droplets implement inertia, sediment capacity, erosion, deposition and
evaporation. All remaining sediment is deposited on termination. This is a bounded
terrain synthesis algorithm, not a general geophysical or water-flow simulator.

A 257 × 257 Float32 heightfield and matching drainage field cover the generated
region. The module worker transfers both buffers rather than copying them. The
standalone build and browsers without workers execute the identical algorithm on
the main thread. Field preparation is off-thread; mesh, vegetation and building
assembly use cooperative main-thread stages. They are not advertised as fully
worker-based streaming.

Each region has its own asymmetric design corridor. A seed changes corridor scale,
control positions and lateral terrain-cost choices. Cyclic vertical smoothing and
grade projection precede arc-length spline sampling. The alternative route follows
a displaced scenic corridor rather than cutting straight across a central lake.
Rail corridors are cut into terrain where appropriate; high-clearance spans receive
piers and additional masonry arches or steel bracing. Station grading remains
linked to the railway.

The **existing four-edge continuous operational circuit is retained** so turnout
history, AI, signals, station services and train saves remain compatible. These
are no longer elliptical loops, but this release does not claim arbitrary network
routing, point-to-point train operations or a universal railway alignment solver.

## Rendering and ecological detail

Terrain is split into 640 m tiles with 20 m near-route mesh spacing, coarser distant
tiles, explicit near/far alternatives and skirts to conceal LOD seams. Surface
normals account for railway earthworks. Moisture and drainage occupy the existing
vertex UV channels. Both WGSL and GLSL implement matching slope / altitude / climate
material blending, triplanar microvariation, sedimentary bands, shore gravel,
heather variation and snow. Vertex and instance layouts remain 32 and 96 bytes.

Jittered cells and low-frequency habitat masks distribute vegetation. Slopes,
water, snow, railway clearance and station sites exclude unsuitable placement.
Conifers, broadleaf crowns, birch bands, cherry trees, bamboo, cactus, ferns, grass,
flowers, shrubs and displaced boulders are actual geometry. Near-track ground cover
has short distance limits. Both conifer and broadleaf batches have reduced-geometry
far LODs. Conservative instance-batch bounds account for elevation differences.

## Rolling stock

All six train families receive profile-built flanged wheels, axle boxes, brake
hardware, suspension coils, dampers, solebars, reservoirs, conduits, end couplers,
flexible-looking segmented air hoses, access steps and grab irons. Locomotive
families add electrical busbars / insulators, diesel fan grilles / louvers / exhaust,
or steam pipework / rivets / tender coal. Passenger vehicles add seals, HVAC and
bellows; freight wagons add tank bands or container doors, lock bars and corner
castings. Cab geometry includes seats, instrument faces, controls and switchgear.
The high-speed nose is a smoothly sampled section surface.

Static parts are baked by material, animation role and detail tier into cached
vehicle-local assemblies. Original shell, glass, door, pantograph and headlight
roles remain independently controllable. Close hardware disappears after 100 m;
intermediate detail after 450 m. Wheels, steam motion, doors, pantographs and wipers
retain their existing runtime behavior. Decorative gauges and new roof fans are
not newly simulated physical instruments or rotating machinery.

## Persistence and limits

The project envelope remains format version 2. `editor.generationVersion: 3`
selects this generator. Projects without that field are interpreted as legacy
version 2 and retain their original radial terrain and track alignment. The
simulation save key is intentionally unchanged. Edited terrain, custom tracks,
rolling-stock state and dispatch state still round-trip. Baked terrain is regenerated
from a compact seed/settings record rather than stored in project JSON.

Worlds are finite, fictional and procedural. There is no photogrammetry, satellite
imagery, infinite streaming, self-adjusting track topology, complete tunnel system,
real-time fluid simulation or newly implemented multibody wheel/rail solver.

## Validation

Run `npm test` for numerical, geometry, LOD, route, persistence and simulation
regressions. `npm run build:pages` validates the module deployment and rebuilds the
standalone distribution. The Expedition browser workflow serves the candidate
artifact under `/RailboundAdventures/` and exercises WebGPU and WebGL independently,
including module workers, varied seeds, all eight regions, all six train families,
mobile layouts, visible nonblank frames and offline startup. Screenshots and JSON
reports are uploaded as CI artifacts. Software-adapter CI validates API and shader
correctness, not physical-device performance.

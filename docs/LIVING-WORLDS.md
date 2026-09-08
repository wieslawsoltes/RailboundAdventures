# Living Worlds — v3.2

## What changed

This round targets geometry, spatial density, and coherent city structure rather
than another exposure/colour preset. Generated worlds retain their seed, terrain
revision and railway. Version-2 imported journeys still retain their old terrain.

## Botany

`botany.js` builds deterministic tree archetypes with tapered trunks and branches,
compound-leaf or needle cards, two shape variants per species, and three levels
of detail. Forests are no longer opaque spheres or layered cones. The same
analytical leaf silhouettes and wind deformation run in the colour and shadow
passes. WebGPU foliage alone uses multisample alpha-to-coverage; WebGL uses the
matching MSAA state. Other opaque and transparent materials keep their existing
pipelines. Far foliage does not cast expensive distant shadows.

Species include fir, pine, oak, birch and cherry. Forest density is approximately
three times the candidate density of the previous grid, with climatic rejection,
patch variation and deterministic thinning by the ecological-density setting.
Desert ecology deliberately stays sparse and retains cacti and juniper-like pine.
Saplings, understory, fallen timber and rocks populate the railway corridor.

`GroundCover` maintains a camera-local cache of 40-metre tiles containing grass,
ferns and wildflowers. Candidate positions are hashed by absolute grid cell,
not by the camera or frame number. Low/medium/high quality changes the radius
and deterministic acceptance rate without moving retained plants. Three new
tiles are generated per normal frame. Tiles leaving the active radius release
their GPU instance buffers. Meshes remain shared. Ground cover is omitted when
the camera is more than 95 metres above the rendered surface. It is excluded
from rail clearance, water, snowfields, steep slopes and settlement reservations.

## Cities and towns

`settlements.js` builds a local street graph around each station, using a
regional footprint and block size. Road segments sample the same triangle
surface used by the camera. Flooded segments, track conflicts and grades over
13 percent are rejected. Only the largest connected street component is built;
a parcel requires a surviving frontage before it can accept buildings.

Parcels contain non-overlapping building footprints or parks. Foundations sample
nine footprint points and reject water, track intersections and more than five
metres of height variation. Footprints remain inside their parcel setbacks.
Metropolitan business districts mix medium and tall glass buildings with
residential streets; rural regions use smaller buildings, gabled roofs and a
lower skyline. Buildings include entries, canopies, steps, balconies, drainpipes,
roof equipment, solar panels or chimneys. Streets include pavements, kerbs,
crossings, lamps, curbside parked cars, parks and street trees.

Facade materials repeat in metre-based local coordinates on every wall. They
include windows, mullions, blinds, per-room lighting, masonry joints and cornice
bands. Roofs, bark and weather-responsive asphalt use separate material types.
Window emission follows the day/night state; facade reflections remain the
existing analytical sky model, not screen-space or ray-traced reflections.

## Performance and limits

Trees are instanced into 320-metre cells by species, variant, role and LOD, with
shared geometry and bounded per-world tree count (70,000 canopy trees before
corridor detail). Fine canopy detail ends at 280 metres, middle detail at 1,300
metres; quality scales those thresholds. The wider far-tree distance provides
wooded horizons. Ground cover has bounded radius, tile count and generation work.
City windows are shader detail rather than one draw call per window.

These are procedural assets, not photogrammetry, licensed scanned vegetation,
architectural survey data or a commercial AAA content library. Street networks
are local station neighbourhoods, not a city-wide road simulation. Vehicles are
parked scenic objects, not simulated traffic; door/window interiors are shader
patterns, not enterable buildings. Rail topology and longitudinal dynamics are
unchanged. Shader tests on software GPUs do not establish native GPU frame rates
or physical-mobile compatibility.

## Validation

`npm test` includes deterministic archetype, LOD, invalid input, street graph,
foundation, parcel overlap, quality nesting, GPU-cache lifetime and offline-shell
regressions. `tools/verify_living.py` renders each region in both browser backends,
inspects cities and woodland at closer camera positions, verifies animated wind,
night lighting, ground-cover budget reduction, driving/braking, save restoration,
touch layout and offline reload. CI retains PNGs and JSON reports for visual
review; nonblank images alone are not a realism assertion.

## References

The implementation is original. Relevant public technical references:
- WebGPU specification, multisample state: https://gpuweb.github.io/gpuweb/#dictdef-gpumultisamplestate
- GPU Gems 2, *Toward Photorealism in Virtual Botany*: https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-1-toward-photorealism-virtual-botany
- GPU Gems, *Rendering Countless Blades of Waving Grass*: https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-7-rendering-countless-blades-waving-grass

The 70,000-canopy-tree budget uses independent site priorities and a bounded max-heap. It samples across the whole region rather than stopping at the first 70,000 trees in scan order. Forest instance cells are 320 metres wide to reduce submission overhead without changing individual trees.

Street reservations are computed for all districts before buildings are emitted. A planar separating-axis test excludes overlapping building footprints and buildings on any district street, not only their own parcel. Coincident street spans are deduplicated.

Visual review refinements use smaller, more numerous near-field leaflets, darker regional foliage palettes, flat-interpolated instance material IDs, and quantized room-light seeds so tiny interpolation error cannot produce shimmering window pixels. Close-up browser captures explicitly verify camera clearance against rendered triangles.

Corridor understory uses a fixed 6.5-metre candidate lattice with independent hashed site priorities; ecological density thins the same sites from 25 to 170 percent instead of keeping the full near-track budget at low density.

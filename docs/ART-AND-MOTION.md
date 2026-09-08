# Art & Motion — 3.4

This release adds textured natural meshes, revised botanical silhouettes, regional
station architecture, smooth coach shells and camera-reprojected temporal antialiasing.
It is not a claim of commercial AAA equivalence.

## Art library

Four Poly Haven CC0 source sets supply six mossy rocks, one stump, four fern models
and a needle-twig texture. The full pine-tree model is not shipped. Artist credits,
source URLs, hashes and conversion settings are recorded in `assets/authored/manifest.json`
and `LICENSE.txt`. Website preview renders and logos are not included.

The offline glTF converter applies node transforms, inverse-transpose normals and
handedness, preserving metre scale and UV coordinates. Objects are recentered at the
XZ bounds center and bottom Y. Attribute-aware simplification with meshoptimizer 1.2.0
produces three levels per model; boundary locking may retain more than a target count.
The runtime reads a validated 3,964,656-byte binary pack containing 33 geometries,
not a runtime glTF library. Bounds, counts, alignment, overlaps, indices and finite data
are checked before meshes enter the scene.

Color/opacity is sRGB RGBA. Normal XY, roughness and AO are linear RGBA. Arrays use
512px layers on desktop, 256px on narrow cold starts, with mipmaps and anisotropic
sampling. Fern alpha is explicit; pine imagery is cropped to one twig. Hidden RGB is
dilated before resizing to reduce dark fringes. Mips are hardware generated, not
alpha-coverage preserving. Runtime requests are same-origin, bounded, abortable and
fall back to procedural scenery when assets fail.

Near-track ensembles use deterministic placement and shared transforms across levels.
Railway, water, steep-ground and settlement exclusions remain active. Moss/fern ensembles
are omitted from the desert. Assets have cached shared CPU geometry and renderer-owned
GPU allocations. This is a curated small library, not a complete scanned environment.

## Stations and rolling stock

Platforms receive short track-aligned roof bays with curved surfaces, paired truss
chords, diagonals, purlins, columns, footplates, braces and light strips. Two masonry
wings surround a glazed concourse with independent roof ribs, mullions, sills, cornices,
entrance handles and clock geometry. Classical regions have gables/chimneys; coast,
Sakura and metro receive the modern roof variant. Semantic stopping points do not change.
Version-2 worlds retain their legacy station kit.

Coach bodies have smooth manufactured cross-sections, planar window-bearing sides,
rounded roofs/underbody corners and rounded glazing/seals. Existing doors, wheels,
pantographs, headlights, cab roles and physics remain functional. The models are
fictional forms, not commercial train scans.

## Temporal rendering

High/Ultra HDR uses an eight-sample Halton jitter, two full-resolution rgba16float
history textures and camera reprojection from radial depth. Accumulation uses a 3x3
YCoCg neighborhood/variance clip and motion/luminance-dependent history weight.

The auxiliary alpha channel stores indirect-light share: positive for static surfaces,
`-share - 0.1` for reactive surfaces. History alpha stores radial depth, negative for
reactive pixels. Every contributing bilinear history tap is depth/validity checked.
Moving trains, birds, water and transparent effects reject accumulation. A separate
alpha-only MIN-blend pass marks visible transparent fragments while preserving opaque
normal/depth data, on WebGPU and WebGL alike.

This is camera-only temporal AA, not per-object motion vectors. Fast deforming foliage
can still show artifacts. Sky rejects history. No temporal upscaling, dynamic GI or
ray tracing is claimed. Camera cuts, world replacement, FOV/mode changes, lighting or
material/shadow/quality changes and resized/replaced targets invalidate history.
Low/Medium, disabled TAA and WebGL without float targets retain spatial rendering.
Turning TAA off releases both histories; post bind groups cannot retain destroyed targets.

Two histories cost `width * height * 16` bytes. Display/bloom, AO and temporal pass
counts remain separate. The toggle is in **Display & immersion → Temporal antialiasing**
and survives project save/restore. All assets are precached and embedded in the standalone.

## Rebuild

Normal `npm test` and `npm run build:pages` use committed assets without downloads.
To explicitly regenerate art:

```sh
python -m pip install numpy==2.3.5 pillow==12.3.0
python tools/acquire_authored.py /tmp/railbound-art --expected assets/authored/manifest.json
npm pack meshoptimizer@1.2.0 --pack-destination /tmp
mkdir -p /tmp/meshopt && tar -xzf /tmp/meshoptimizer-1.2.0.tgz -C /tmp/meshopt
python tools/prepare_authored.py /tmp/railbound-art /tmp/railbound-converted
node tools/simplify_authored.mjs /tmp/railbound-converted /tmp/meshopt/package
python tools/prepare_authored.py --pack /tmp/railbound-converted assets/authored
npm test
npm run build:pages
```

## Verification

`tests/authored.test.js` checks real files and geometry, asset fallback, lifetimes,
station contracts, smooth winding, reactive encoding and postprocess binding.
`tools/verify_authored.py` renders real scenes and isolated engine fixtures, including
subpixel movement, camera cuts, repeated toggles/resizes, real driving/braking,
settings restoration, mobile cold start, missing art, offline caches and standalone use.
`tools/temporal_probe.js` reads the actual HDR targets to verify that reactive objects
and vacated silhouettes do not reuse stale history. Existing simulation, all-region,
Living Worlds, Fidelity and Cinematic tests remain in place.

Software-GPU tests establish API/shader/behavior correctness, not hardware frame rates
or physical-device compatibility. See CI artifacts for screenshots and exact results.

References: https://polyhaven.com/license ; https://api.polyhaven.com ;
https://github.com/zeux/meshoptimizer ; https://www.w3.org/TR/webgpu/

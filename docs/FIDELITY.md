# Material & Lighting Fidelity — v3.3

## Pipeline and ownership

The application still owns its WebGPU and WebGL 2 renderers; no renderer framework is added. Material acquisition is a separate explicit developer task. Normal builds and runtime do not contact the asset provider.

`SurfaceLibrary` owns eight-layer sRGB color and linear packed-surface arrays. At desktop startup each layer is 512px with ten mip levels; a viewport at most 600 CSS pixels wide selects 256px with nine levels. The two arrays consume about 21.33 MiB or 5.33 MiB respectively, excluding decoder staging and driver overhead. Resizing a running desktop session does not silently reload its material tier. Two image pairs decode concurrently. The surface layout is **normal-X, OpenGL normal-Y, roughness, occlusion**. Albedo receives hardware sRGB decoding; surface data must not receive a color-transfer function. Mips and anisotropic filtering reduce minification aliasing. Signed triplanar projections avoid cliff stretching; species tint is retained for bark.

Both pipelines use the same material-layer numbering. Gradients are captured before material/alpha-test divergence and supplied explicitly to texture sampling. Normal mapping can be disabled independently of color maps. Metallic and dielectric direct light retain GGX/Schlick evaluation; the additional specular environment response samples an analytical sky and roughness-dependent direction. **This is not captured, convolved environment-map IBL or global illumination.**

Hash mismatches, decode failures and a 30-second loading deadline leave the original procedural materials active. All concurrent decodes settle and all bitmaps close before the failure path completes. Disposal aborts fetches, prevents late uploads, and destroys owned textures. The standalone build embeds the same manifest and texture bytes. The project-scoped service worker caches every runtime module, manifest and map.

## Shadows and ambient visibility

Three overlapping light-space projections have half extents of 72, 280 and 1,100 metres. Their translations snap to light-space texels, and each depth-array layer receives its own uniform-buffer snapshot. Receivers blend across range borders. These are **nested orthographic shadow ranges**, not logarithmic camera-frustum splits. Low quality renders only the middle range. All ranges reuse existing geometry and foliage cutout/wind code; only depth images and uniforms are per-range resources.

The opaque pass writes linear HDR color plus an auxiliary RGBA16F target: octahedral geometric normal, radial camera depth in metres and an estimated indirect-light fraction. Transparent effects do not overwrite the auxiliary target. Ambient visibility is calculated at rounded half resolution using 8/16/24 samples on medium/high/ultra within a 3.2m world radius. Depth-aware upsampling avoids simply blurring through foreground silhouettes. Sky and distant pixels are excluded; low quality or zero strength omits the pass. The final display attenuates an **estimated scalar share of ambient contribution**, not the entire direct-light/emission image. This is spatial SSAO, not temporally accumulated GTAO, ray-traced contact shadows or an exact separate RGB indirect-light buffer.

Attachments follow resize ownership, and WebGL no-float devices retain their LDR presentation path with ambient contact shading disabled. The existing ACES-style display fit, bloom, grading and photo settings remain functional.

## Architectural detail

`urban-detail.js` creates near-field window frames and sills on a metric grid matching the facade shader. Static hardware is instanced in a bounded batch per building, sharing box geometry; there is no separate draw call or mesh allocation per window. Detail range is 360m before quality scaling, and upper-storey additions are capped. Glass towers receive frames on the podium only so frames cannot float outside recessed upper volumes.

Ray-box facade shading provides view-dependent floors, walls, ceiling, a picture and simple furniture silhouettes. It is a shader illusion, not an enterable interior. Windows still participate in the previous seeded day/night occupancy model. Entrances have small handles, notices and lamps; suitable local centres get striped shop awnings. Paved building aprons sample actual rendered terrain, reject water/rail intrusion and stay within reserved footprint margins. Sidewalk slabs use the dedicated paving material. Selected built streets receive shared slatted benches, bins and drain details.

## Controls

Open **Settings → Display, immersion & photo studio** (or Display & immersion) to toggle **Surface materials**, **Normal mapping** and **Contact shading** strength. These are saved with existing cinematic settings. Low quality keeps textures but drops the ambient pass and reduces the number of shadow ranges. Mobile-start sessions use smaller material arrays. Existing train dynamics and generator/save revisions are unchanged.

## Assets and provenance

The eight selected surface sets are distributed by **ambientCG / Lennart Demes** under **CC0 1.0 Universal**:

- https://docs.ambientcg.com/license/
- https://creativecommons.org/publicdomain/zero/1.0/

`assets/materials/manifest.json` records the original asset pages, archive URLs, source SHA-256 and derived file SHA-256. `tools/acquire_materials.py` is a bounded acquisition recipe with no archive-path extraction and never runs during normal builds. Ground037, Ground048 and PavingStones036 are sourced as surface photogrammetry; the other chosen materials are procedural/approximated. Do not describe all eight as photoscans. Texture tile sizes without published real dimensions are artistic choices, not survey measurements.

## Verification and limits

Run `npm test` for numerical, geometry, asset integrity, fallback, lifetime and existing simulation regressions, and `npm run build:pages` for offline project-relative builds. `tools/verify_fidelity.py` exercises the actual module or standalone application in a real browser, captures scenes without UI overlays, and compares toggled rendering features. It checks both backends, off-line material restoration, display controls, driving and viewport resizing. CI software adapters verify APIs, shaders and behavior, not hardware frame rates or physical phones.

This release implements specific material, lighting and architecture systems. It does **not** establish a closed gap to commercial AAA art direction: botanical silhouettes, regional scene composition, character animation, interactive interiors, authored hero assets and long-distance terrain transitions still warrant further art work. There is no ray tracing, real-time GI, temporal AA/upscaling, recorded asset-library audio, arbitrary route-network replacement or licensed commercial train scan in this change. Review actual scene captures rather than inferring visual quality from passing tests.

Technical background: https://google.github.io/filament/main/filament.html and https://www.w3.org/TR/WGSL/. Implementation is original; no external renderer source is bundled.

## Natural-surface repetition and numerical edge cases

Terrain, soil and rock use a smooth non-folding UV domain warp. Analytic Jacobians transform texture footprints, and the transpose Jacobian transforms sampled tangent-space perturbations. This breaks obvious repeated grid alignment without adding texture reads. Built surfaces (pavers, concrete and bark) retain their original metric projection. Regional grass palettes modulate the measured mean-linear color of the ground source; dry soil and cliff layers remain distinct. This is not stochastic texture synthesis.

Window-box rays use nonzero, sign-consistent reciprocal axes, including grazing/axis-aligned views. Shadow framing rejects invalid or zero directions and selects a nonparallel up vector at zenith. Numerical regressions cover these cases.

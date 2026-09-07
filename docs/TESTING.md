# Delivery verification

Recorded 7 September 2026. This report distinguishes tests actually executed
from implemented paths that still require target-hardware validation.

## Results

| Suite / path | Result |
| --- | --- |
| Node core suite | 29 passed; 0 failed. |
| Chromium integration suite | 61 checks passed; 0 failed. |
| Browser JavaScript/console error collection | No errors in the integration run. |
| Rendering actually exercised | WebGL 2 through Chromium ANGLE/SwiftShader. |
| Native WebGPU runtime | Not exercised in a secure native-GPU browser. |
| Desktop layout | 1440 × 900 browser viewport, rendered screenshots. |
| Portrait layout | 390 × 844 browser viewport with touch enabled; controls exercised. |
| Landscape layout | 844 × 390 browser viewport with touch enabled; rendered screenshot. |
| Physical phones/tablets | Not tested. |
| Physical controller and audio hardware | Not tested. |
| Service-worker install, offline and home-screen flows | Implemented, not browser-verified here. |
| Performance / thermal certification | Not performed; no FPS claim. |

The JSON integration results are in
`tests/browser-integration-report.json`; the core TAP transcript is in
`tests/core-test-results.txt`. Screenshot images are provided separately. They
are actual screenshots of the supplied game, not generated concept artwork.

## Core tests

`npm test` uses Node's built-in runner; no `npm install` is necessary. The tests
exercise matrix inversion and clip-space contracts, deterministic generation,
all eight rail layouts, arc-length cursors, long runs and bounded history,
turnout-history following, spatial rail queries, traction and energy, braking,
interlocks, wet adhesion/sanding, reverse movement, deterministic integration,
invalid time steps, blocks/signals and turnout locking, station dwell, project
validation, steam snapshot round-tripping, terrain/custom rail changes, AI
station departure, train-contact intervals, immediate emergency traction cutoff
and invalid saved-cursor rejection.

The exact named assertions are in `tests/core.test.js`. Passing these is not a
claim of formally verified dynamics or realistic real-train coefficients.

## Browser procedure

`tools/integration_browser.py` uses Python Playwright and an installed Chromium.
The delivery environment used `/usr/lib/chromium/chromium`, Linux Xvfb display
`:99`, and ANGLE's software SwiftShader WebGL 2 backend. Adapt the executable path
and display configuration to your test machine. The test-only software-renderer
flags are not application requirements or deployment instructions.

Because the managed browser blocked URL navigation, tests loaded the standalone
HTML into an `about:blank` page with Playwright's `set_content`. That page did not
expose a secure WebGPU context. No managed browser policies were changed. It would
be incorrect to present successful WebGL testing as native WebGPU validation.

The full-game smoke test keeps the real animation loop active. The integration
runner suppresses continuous rendering between explicit screenshot cases so
software rendering does not starve interaction tests. World generation, shader
compilation, UI actions and physics remain real. Screenshot cases explicitly
invoke the same renderer on actual world and rolling-stock batches. Simulated
35-second driving and 50-second braking sequences use exact fixed physics steps;
they do not wait that many wall-clock seconds.

The checks include all ten panels, departure motion, emergency stopping, steam
stock/consist changes, rain/wipers, imported camera/dispatch/clock and transient
locomotive state, invalid import preservation, AI creation, scenery staging,
undo/redo/apply, construction of every world, day/night and cab renders, six
finite camera modes, mobile overflow checks and live throttle-slider behavior.
The new screenshots wait for the normal loading overlay exit transition before
capture.

The stand-alone build is the tested browser artifact. The module source shares
the same code, but source-root HTTP loading and the service worker were not
exercised through that managed browser navigation path.

## Reproduction

```sh
npm test
python3 tools/build.py
# Optional: install Python Playwright and provide your Chromium executable.
python3 tools/integration_browser.py
python3 tools/smoke_browser.py
```

The default browser scripts intentionally point to the delivery test environment.
On another machine, change the Chromium executable and remove or adapt Xvfb and
software-renderer arguments as appropriate. A test failure raises an exception
and produces a failure screenshot. The integration JSON is rewritten each run.

## Required target-hardware follow-up

Native WebGPU shader/pipeline compilation, shadow correctness and context-loss
behavior need to be checked on actual supported desktop and mobile browsers.
Also verify physical touch/pinch behavior, audio activation, gamepad connect and
disconnect, repeated long sessions, memory under many world swaps, save recovery
under storage pressure, offline installation, device orientation and safe areas.
The low/medium/high/ultra settings should be benchmarked on named hardware with
frame-time percentiles and power/thermal behavior before publishing performance
claims.

## GitHub import validation

The GitHub import reran the core tests and Pages artifact validation. The 61 browser checks above and `tests/browser-integration-report.json` record the original development session, not a new CI graphics pass. Earlier CI graphics attempts could not initialize WebGPU or WebGL 2. Renderer certification remains separate from static deployment validation; native WebGPU and physical mobile devices remain unverified.

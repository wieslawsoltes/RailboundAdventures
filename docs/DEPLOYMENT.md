# GitHub Pages deployment

Production URL: https://wieslawsoltes.github.io/RailboundAdventures/

## Pipeline

`.github/workflows/pages.yml` checks out the exact revision, runs `npm test`,
and runs `npm run build:pages`. The latter rebuilds the standalone distribution,
copies only runtime assets into `_site/`, validates HTML/module/manifest and
service-worker dependencies, and stamps the offline cache with a content hash.

The artifact includes the source-module application with PWA support and
`downloads/Railbound-Adventures.html`, the self-contained distribution. A
`version.json` identifies the source commit and artifact content version.

Pull requests build and test without deploying. Pushes to `main` and manual
workflow dispatches publish with the official GitHub Pages artifact actions.
The build job has read-only repository access; the deployment job has only
`pages: write` and `id-token: write` in addition to content read access.

Pages must be enabled for the repository. This repository already had Pages
enabled when the initial publication was requested. Future deployment changes
are in Settings > Pages; choose GitHub Actions as the publishing source.

## Local verification

```sh
npm test
npm run build:pages
python3 -m http.server 8000 --directory _site --bind 127.0.0.1
```

All assets, ES-module imports, manifest URLs and service-worker registration
are relative to the project root, not the github.io origin root. Do not replace
them with `/src/...` or `/assets/...` paths.

The service worker is network-first, with a versioned offline app shell. Its
cache version changes when runtime content changes. Browser storage remains
local to the browser; static hosting does not add a game backend.

## Initial source import

The complete generated source archive is imported once by a checksum-verified
bootstrap workflow into `main`, including images, documentation and tests.
The ordinary Pages workflow then uses repository files only: normal builds do
not depend on external staging storage. No personal access tokens, deployment
secrets, or external runtime dependencies are embedded in the game.

## Verification boundaries

Core tests and static artifact validation run in CI. The original integration
report covers 61 offline Chromium/WebGL 2 checks. A fresh local core run passed
29 tests before publication. This environment blocks browser network navigation,
so public deployment verification uses HTTP/content checks; hardware WebGPU,
physical mobile devices and a live-origin browser test are not claimed here.

# Browser PWA increment — 27 October 2026

## Changes

The app's canonical Flutter widgets and Dart chess logic remain the source of
truth. Browser Settings adds installation and offline saving; a scoped manifest
and original app icons support standalone launch at `/play/`. No APK publication,
native source change or shared Stable/Preview helper change occurs, so no native
companion port applies. The permanent [web adaptation register](WEB_ADAPTATIONS.md)
records these boundaries and the mandatory app-source upgrade checklist.

Installation or explicit Save for offline use enables the service worker. An
ordinary first visit does not start the full offline shell download. The generated
asset list hashes every shell response with SHA-256 before storage. The modern
Wasm shell includes both browser renderer variants, all native board/piece assets,
fonts, sounds, openings, notices, CPU loader scripts and configuration. Source
maps/unused renderer builds/model weights are excluded. The measured local shell
is about 25.8 MB; 5M+CPU runtime+Stockfish add 38.0 MB. Engine bytes retain their
existing independent size/hash verification and cache identity.

All shell files must save successfully before the worker becomes active. Partial
or corrupt installs are rejected; retries preserve user sessions. The new worker
does not call skipWaiting, so an update waits for old tabs/windows to close. It
removes only old shell caches, not model downloads, preferences or saved games.
The scope is `/play/`; homepage and research navigations are not intercepted.
Used Google Fonts fallback resources may cache at runtime; a language not opened
online may still need a first font download. Storage eviction remains possible.

Settings checks the offline package before claiming it ready. Engine/model
selection remains 5M by default; experimental 79M query selection is supported
but phone download reliability and a full-model selection UI remain follow-ups.
Start game now begins Maia download/session preparation while game setup and
the human's first move proceed; it uses the same promise/session as prediction.
This changes when loading starts, not the model, sampler or chess behavior.

System default Light/Dark behavior remains the original Flutter controller.
Android wallpaper-derived dynamic color cannot be read through browser APIs;
the browser-only disabled control explains this instead of claiming Android12
is missing. The app's Android implementation and translations are unchanged.

## Validation

Offline Node tests execute the actual service-worker template and PWA controller:
full-shell integrity, failed-install rollback/retry, cached navigation with query
parameters, no network fallback on cached offline requests, waiting-update safety,
no forced activation/client takeover, independent/unrelated cache preservation, opt-in registration,
install prompt handling, completed-install progress/status, worker URL fragments, and icon dimensions.

Integration caught two failures before publication: a status reply containing
completed progress was incorrectly treated as an interim progress event; and a
cached worker Response.url dropped Stockfish’s fragment containing its verified
WASM blob URL. The controller now distinguishes status/progress messages; the
service worker returns synthetic asset responses so the original worker request
URL/fragment remains its base. Both have regression checks.
Shared inference/runtime and site/research checks remain required in CI.

Local Chrome: Save for offline use reached Ready for offline play and analysis;
Maia/runtime downloads matched their pinned hashes and were saved. System default
was selectable and the corrected wallpaper-color explanation was visible.
Verification uses isolated QA preferences/IndexedDB/engine cache. Detailed
cold-launch/gameplay/analysis evidence and deployment/cleanup status follow below.

The corrected local build cold-launched successfully after the preview server
was stopped. A real drag e2–e4 received g6; Analysis Board returned two Stockfish
lines (+0.6 Nc3…, +0.5 d4…) and M1500 probabilities d4 35%, Nf3 22%, Bc4 16%,
Other27%. The previous cold launch’s diagnostics independently confirmed Maia
and CPU runtime came from the named cache with their pinned hashes. These are
functional desktop observations, not phone speed claims.

The automated offline fetch tests deny all network access. The real-browser
cold-launch check stops the local web server, then confirms cached model/runtime
sources; it does not change the user's device/network or claim a physical-phone
airplane-mode or installed-iOS test. Physical Android/iOS installation, long-game
performance, background lifecycle and eviction testing remain follow-ups.


## Public verification and cleanup

Published source `d556b4336a2855a80e656bec9cfaa8d1f8c97d91` passed
[CI/build/deployment](https://github.com/Dash1971/mobilemaia.org/actions/runs/40507354232).
The public build is `8b4cef12a8921e1f`, offline release
`353e46e831de89d89ef5`. Its manifest and source metadata identify the exact
website/app/compiler sources and link to the register at the website commit.

An initial public cache installation failed without a detailed reason. All 856
published asset bodies were independently fetched and matched their pinned
hashes. A UI retry succeeded; the initial failure's exact cause was not
established. The follow-up adds a cache-bypassing download retry and detailed
install/storage errors. Entry scripts and their PWA dependency now carry
content-based query versions before offline activation as well.

The public update was prepared while the previous version remained running.
Closing/reopening the owned test tab loaded the new version, with saved engines
still present. Settings reported Ready for offline play and analysis; Chrome
reported install eligibility. A fresh Analysis Board session returned real
Stockfish lines (+0.4 e4…, +0.3 d4…) and Maia1500 probabilities e4 64%, d4 24%,
c4 3%, Other9%. Diagnostics confirmed both Maia and the CPU runtime loaded from
cache with their pinned hashes. The observed session initialization was 1.60 s
and inference 155.5 ms on desktop; these are observations, not a phone benchmark.

See the [public build](browser-pwa-2026-10-27/public-build.json),
[source manifest](browser-pwa-2026-10-27/public-source.json),
[update state](browser-pwa-2026-10-27/public-update-diagnostics.json),
[engine diagnostics](browser-pwa-2026-10-27/public-diagnostics.json),
[offline-ready screenshot](browser-pwa-2026-10-27/public-offline-ready.png),
[asset check](browser-pwa-2026-10-27/public-asset-check.json) and
[cleanup record](browser-pwa-2026-10-27/cleanup.json).

Immediately after public verification, the isolated local/public QA engines,
data, preferences and model/runtime downloads were cleared, all owned preview
servers/tabs stopped, and task-owned source/build/deploy/log scratch removed.
The public application service worker/shell remains intentionally as the
requested feature; normal user games, preferences and model caches were not
cleared. Shared tools/native source were preserved. No desktop PWA was installed.

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

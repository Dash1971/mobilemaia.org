# Mobile Maia web adaptation register

This is the continuing maintenance reference for differences between the Android
app and the browser/PWA. Update this register in the same change as an adapter,
behavior difference, or app-source upgrade. Dated verification reports are
evidence; this file describes the current architecture and upgrade contract.

## Sources of truth

- App UI/domain source: Stable 2.5.0,
  [`aeea49817c34f48397e910894414c1d8b0352124`](https://github.com/Dash1971/maia-chess-android/tree/aeea49817c34f48397e910894414c1d8b0352124).
  `tools/prepare_browser_app.py` owns the source pin; the Pages workflow checks out
  that exact commit. Change both together when upgrading.
- Compiler: Flutter 3.47.8, revision
  `737ba8f885dc774b53b442759999a312c9461e4e`, pinned in
  `tools/build_browser_app.py` and the workflow.
- Transformation: `tools/prepare_browser_app.py` exports the app read-only and
  applies exact source-fragment replacements to a disposable build copy.
  `browser-app/platform/` and `site/play/native/` implement browser boundaries.
  No independent JavaScript chess UI, rules engine, encoder or sampler is maintained.
- Deployed `/play/app/source.json` records the app/website/compiler source,
  changed platform-boundary files, and hashes of canonical UI/logic files.
  Source maps are published with the generated bundle.

## Bring these features over from the app

Use the app's actual widgets, wording/translations, chess rules, legal moves,
drag/tap behavior, highlights, board/piece preferences, premoves, clocks, rating
controls, sampling/history settings, PGN/FEN/variation logic, analysis engine rows,
review classification/graphs, session/history formats, and diagnostics logic.
Do not recreate or separately redesign those features for the browser.

Native fixes and new UI/features should enter through an intentional source-pin
upgrade. An Android-only platform implementation is a dependency to adapt, not
a reason to silently omit its user-facing feature. Electronic-board support is
the explicit product exclusion below.

## Intentional web adaptations

| ID | Difference and reason | Implementation / upgrade attention |
| --- | --- | --- |
| W01 | Maia defaults to the historical 5M model on single-threaded CPU WASM; experimental `?model=79m` selects the pinned full-model download. Models/runtime are fetched and SHA-256/size checked, rather than bundled in an APK. No equal-strength/calibration claim. | `native/maia-worker.mjs`, `native/platform.mjs`, lab `config.json`; Dart `maia_chess/engine` channel becomes `BrowserMaiaChannel`. Preserve raw tensor types/shapes (6,208 inputs, 4,352 policy and 3 value outputs), rating/history input, and Dart sampling. Revalidate model/runtime/API changes against reference fixtures. |
| W02 | Begin preparing Maia when Start game is pressed, overlapping download/session creation with setup and the human's first move. No extra synthetic prediction and no model download merely for visiting the site. | Guarded `_startGame` addition in `play.dart`; `prepare` platform method shares the same initialization promise as `predict`. Check new-game, resume, reset, failure/retry and background release semantics. |
| W03 | Stockfish uses verified Stockfish.js 19 Lite, single-threaded, instead of native multistockfish/full network. App UCI scheduling, MultiPV, scores and engine-row/review UI remain shared. | `browser-app/platform/stockfish.dart`, `native/platform.mjs`, `stockfish.json`, local GPL worker. Review native wrapper API and UCI changes; test cancellation/stale replies and actual review. |
| W04 | `dart:io` session/sampling file operations use a browser file mirror with queued durable IndexedDB writes. File formats and native repositories are retained. | `browser-app/platform/io.dart`, `bridge.dart`, `native/platform.mjs`; `active_session_store.dart` enables the repository in browsers. Check every newly used I/O method, rename/write ordering, quota failures and recovery. No promise that browser storage survives eviction. |
| W05 | SharedPreferences has its own `mobileMaiaNative.` prefix. QA uses an isolated prefix/database/cache so tests do not alter user games. | `main.dart`, `bridge.dart`, `native/platform.mjs`, `host.mjs`. Preserve established normal keys and migration compatibility; clear only the exact QA namespace. |
| W06 | Dart isolate jobs are scheduled asynchronously on the browser thread. Native session/sampling work and the existing review classifier are reused. | `runBrowserTask` substitutions and the browser branch of `MoveClassificationJob.spawn` in `review_widgets.dart`. Review responsiveness/cancellation when new background work is introduced; long-game phone performance remains a test requirement. |
| W07 | File picker, PGN save/share, FEN clipboard, external links, audio and screen wake lock use browser APIs. Share currently downloads PGN; pending Android PGN intents are unavailable. | `BrowserMaiaChannel`, `native/platform.mjs`, `sound_effect.dart`. Reconcile newly added MethodChannel methods. Clipboard/audio/wake behavior depends on browser permissions, user activation and lifecycle. |
| W08 | Light/Dark/System default and pure black use the original appearance controller. Browser System default follows OS light/dark. Android wallpaper-derived dynamic colors are unavailable, regardless of Android version; the disabled control explains that accurately. | `app_appearance.dart` platform guards and capability subtitle. Do not replace System default with wallpaper colors, fabricate a palette, or infer Android version from a browser. Preserve app theme/settings behavior. |
| W09 | Android Material presentation is used on all browser platforms to match the app. Roboto and native icon fonts are local; icons are not tree-shaken, preserving the same icon assets across compiler targets. | `app_appearance.dart`, generated pubspec/fonts, build flags. Verify toolbar/settings icons, accessibility, light/dark and translations after SDK/asset changes. Flutter may fetch missing-script/symbol fonts; used fallbacks are cached when possible. A language first opened offline may lack its extra fonts. |
| W10 | Eboard controls are excluded from web scope. Transport code is still canonical source but Home/Settings entry points are hidden. | Two guarded `play.dart` substitutions. Check for new eboard entry points on upgrade. Do not port Bluetooth/USB/serial/device setup implicitly. |
| W11 | Diagnostics and PGN model labels identify browser/5M or79M, rather than claiming Android/79M. | `diagnostics.dart`, `play.dart`, `samplingMetadata`/`systemDiagnostics` platform methods. Audit any newly added model/backend labels and exports. |
| W12 | The same Flutter entry/UI builds to DartWasm/SkWasm and dart2js/CanvasKit. Flutter's default browser gates select the fallback (the pinned SDK disables Wasm for Safari/Firefox); `?renderer=js` forces it for QA. In a disposable hash-pinned dartchess copy, a conditional SquareSet export uses exact unsigned 32-bit limbs for JS and retains upstream int64 for Wasm. Constant board/castling masks are split without changing rules. No COOP/COEP or unsafe browser flags required. | `browser-app/chess/square_set_js.dart`, `tools/prepare_browser_chess.py`, `browser_entry.dart`, build helper. Locked Pub resolution precedes a scratch-only package-config redirect; never patch shared Pub cache. Preserve equality/hash, modulo-64 subtraction/shift semantics, constructors/iteration/mirrors, and source-tree hash guard. Every build runs BigInt arithmetic checks, known perft, and upstream VM vs compiled-JS game/FEN/SAN comparisons (`tools/test_browser_chess.py`). Check actual Safari engines/storage/offline on devices; desktop compilation is not iOS qualification. Diagnostics report the actual Dart compiler. |
| W13 | `/play/` presents a phone frame on desktop and a full viewport on phones. Installation metadata launches this same app route in standalone mode. | `host.css`, `host.mjs`, `manifest.webmanifest`, locally resized original app icons. Homepage/research stay ordinary static HTML. Verify desktop, phone, installed safe areas and browser Back/navigation. |
| W14 | Installation or Save for offline use enables a custom `/play/` service worker that precaches a content-versioned, hash-checked shell for both compiler targets. CanvasKit's full variant is selected consistently so fallback clients have the right cached renderer. Settings can save/check selected Maia, CPU runtime and Stockfish for offline play. Updates wait until existing clients close; no forced reload during games. | `browser-app/pwa/sw.js`, generated asset list in the build helper, `pwa.mjs`, browser-only `settings.dart`. The 40 MiB shell budget includes JS/full CanvasKit and both SkWasm variants; source maps and unused CanvasKit variants stay excluded. Never cache whole-site navigations or unverified model bytes in the shell. Engine caches remain independent across updates. Test both targets' offline cold launch and real engines, failed/quota-limited installs, waiting updates and saved-game preservation. |

Paths abbreviated as `native/` above are under `site/play/`. Browser-specific
installation/offline controls and capability explanations currently use English;
canonical app translations remain unchanged. The full-model download UI,
physical-phone memory/performance testing, first-use offline language fonts and
long-game review responsiveness remain explicit follow-ups, not parity claims.

## App-source upgrade checklist

1. Read the target Stable/Preview release instructions; select an exact app
   commit intentionally. Review its diff from the previous pin, including
   dependencies, all new imports, MethodChannels, file/isolate calls, lifecycle,
   model formats, UI/settings and artwork/licenses. Do not publish/promote an
   Android release as a side effect of a web update.
2. Update the source pin in the preparation helper, workflow and this register.
   Update the compiler pin only when required and assess browser compatibility.
   Reconcile **each** W01–W14 adaptation with the new source. Delete obsolete
   patches rather than preserving outdated app behavior. A failed exact-fragment
   guard is a review prompt, not a reason to loosen the assertion globally.
3. Prepare a new disposable project. Inspect every file listed as a modified
   platform boundary. Keep the canonical UI/domain hash assertions: update the
   expected source/pin rather than independently editing protected widgets.
   If a newly needed UI adjustment is truly web-specific, describe it here,
   bound its transformation precisely, and test the shared behavior it touches.
4. Run site/research checks, inference/runtime tests, PWA tests, and the pinned
   Flutter build with the shared SDK/pub cache and disk preflight. Inspect
   generated `source.json` and the offline asset list for source/model leakage,
   accurate provenance, cache version changes and size budgets.
5. Verify real drag/tap/legal/highlight behavior; Maia reply and analysis rows;
   PGN/FEN/editor; settings/theme; reload/Recent games; game review; old saved
   data; install flow; offline cold start with real engines; failed downloads;
   safe updates with an open game. Include physical Android/iOS lifecycle and
   representative long-game tests when those surfaces change. Desktop viewport
   emulation does not establish phone performance.
6. Publish, check the actual public artifact/source manifest and affected
   behavior, retain compact evidence, and clean only task-owned bulk/processes.
   Report remaining web differences. Shared native build/tooling changes require
   Stable/Preview companion assessment; website-only adapters need no native port.

## Guard limits

Web entry scripts and their PWA dependency use content-hash query versions even
before the service worker is enabled. Compiled assets use content-hash directories.
Preserve both when changing the build; an uncontrolled first visit must not mix
new app code with an old HTTP-cached platform/install controller.

Exact replacement counts detect changed patch sites. UI hashes establish that
selected files came through preparation unchanged; they do not prove all app
features work on the web. Compilation catches many API changes, while runtime
and offline tests catch platform behavior. A new MethodChannel or platform-only
feature can compile but fail only when opened, so the source-diff/API review above
is mandatory. Use these checks together, not as an automatic feature-parity claim.

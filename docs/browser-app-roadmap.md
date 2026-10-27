# Mobile Maia browser edition: staged plan

Updated 2026-10-27. Product direction: let someone try Mobile Maia on the website
or as a PWA before deciding whether to install the Android app. Desktop visitors
see an interactive phone presentation; phones use the whole browser viewport.
5M is the default model, with 79M an explicit optional download. Electronic-board
support is outside the web scope. This is a multi-increment plan, not a claim that
all features are already available or scheduled to run automatically.

## Reference and current position

Feature/UI reference is published Stable **2.5.0**, app source
`aeea49817c34f48397e910894414c1d8b0352124`, checked against its README, source and
actual 2.5 screenshots. See the
[release](https://github.com/Dash1971/maia-chess-android/releases/tag/v2.5.0) and
[feature guide](https://github.com/Dash1971/maia-chess-android/blob/aeea49817c34f48397e910894414c1d8b0352124/README.md#feature-guide).
The dark green app palette and Home → Game → Settings flow inform this increment;
the browser preview is not yet a pixel-for-pixel or feature-complete copy.

Available now: 5M CPU play, White/Black, four rating settings, legal moves and
promotion, takeback, PGN export, verified/cached engine downloads, one reusable
session, and startup diagnostics. The inference benchmark separately offers
5M/79M and CPU/WebGPU. Today’s playable sampling/rating defaults remain those of
the existing prototype (1600, Temperature 1 / Top-P 1); they have not silently
changed to Stable 2.5 defaults.

## Small, reviewable increments

| Increment | Outcome | Completion criterion |
| --- | --- | --- |
| 1 — App presentation | Phone frame on desktop; edge-to-edge app on phones; dark green appearance; real Home, Game and Settings screens | Existing game and engine survive navigation; board and controls fit narrow screens; no pretend Analysis/Recent buttons |
| 2 — App foundation and continuity | Choose the shared-code approach, then align settings/state; saved preferences, active-game recovery and Recent games | Reload/background recovery keeps a game; PGN/data formats are documented and compatible where practical |
| 3 — Playing and model choice | Native-style side/rating/time controls, core game actions, sampling controls, and explicit 79M download/use | 5M stays useful without a large download; model identity is clear; switching/retrying/cancelling preserves game state |
| 4 — Analysis Board | PGN import, FEN/editor, variations, Maia move probabilities, local Stockfish and Continue from here | A real imported game/position can be explored with correct turn/orientation and recoverable state |
| 5 — Game Review | Review-quality levels, comparisons, classifications/explanations and graphs | Results follow the app's documented logic, with model/backend differences measured and disclosed |
| 6 — PWA and wider polish | Installable/offline app shell, safe updates, appearance/board choices, language, sounds and browser-supported feedback | Saved games/models survive updates; first/cached startup and real-phone lifecycle tests pass |

Some work can move earlier when it supports the next slice—for example basic
offline recovery alongside saved games. Each increment should deliver working
behavior and leave the preview usable. We are not attempting all six today.

## Architecture checkpoint before large feature ports

The current small HTML/JavaScript preview is useful evidence for the browser
engine, caching and startup behavior. Before recreating Analysis Board or Game
Review, evaluate reusing the Flutter app UI/domain logic with web-specific
engine/storage/file adapters. Compare that with continuing the modular browser
implementation backed by shared fixtures and formats. Select one approach in a
recorded decision; avoid maintaining two uncoordinated interpretations of the app.

The app currently imports `dart:io`, uses a `maia_chess/engine` MethodChannel,
and depends on native multistockfish. Those boundaries need web implementations;
changing the build target alone is not sufficient. Flutter's
[web FAQ](https://docs.flutter.dev/platform-integration/web/faq) describes browser
I/O/concurrency differences, and its
[platform integration guide](https://docs.flutter.dev/platform-integration/platform-channels)
points web code toward JavaScript interop. No Flutter web build or app-source
refactor was performed in this presentation increment.

The checkpoint should prove one existing app screen + one browser-engine reply,
record first/cached startup, check accessibility and mobile memory/lifecycle,
identify source-sharing and hosting requirements, and decide the implementation
path before broad feature work. Homepage/research content remains ordinary HTML.

## App features to track explicitly

- **Home/play:** White/Black/Random, 600–2600/custom rating, Unlimited and preset/
  custom clocks, navigation through played positions, resign/rematch, takebacks
  and variations. Draw acceptance needs its Stockfish dependency.
- **Game behavior:** clock pause/recovery rules, single/stacked premoves and
  optional charge, human move timing, move/capture/end sounds, supported touch
  feedback. Browser capability differences must be visible.
- **Engine settings:** Temperature, Top-P, five-move opening variety, optional
  move-history input, optional sampling captures, and documented per-game frozen
  profiles. Align with 2.5 new-install defaults deliberately: play/primary analysis
  1500, optional second analysis 2600/off, Temperature 1 / Top-P .95, opening
  variety on, history/capture/score off. Preserve explicit saved choices.
- **Study:** PGN import/export and variation trees, FEN/editor, local game history,
  analysis with Maia/Stockfish, optional second Maia setting and score display,
  game-review quality and explanations. A smaller model does not imply identical
  evaluations, move choices, calibration or classifications.
- **Presentation:** Light/Dark/System, optional black background, approved board/
  piece assets, coordinates/dots/highlights/animation/drag aids, accessible controls
  and the app's supported languages. Android system-color APIs do not automatically
  have browser equivalents.
- **Local data:** checkpoints, Recent games, sampling export/retention, diagnostics,
  clear/reset behavior and migrations. No accounts, analytics or automatic uploads.
- **Full model:** explicit size/progress/cancel/retry, resumable download work,
  independent cache identity, memory checks and actual phone tests. The observed
  79M download problem still needs investigation; availability on every phone is
  not assumed. No unsafe browser flags should be required for the normal trial.
- **PWA:** scoped offline shell, optional model persistence, installation, browser
  back/navigation behavior, update safety and background/eviction recovery.
- **Excluded:** electronic-board Bluetooth/USB/serial connections, device setup,
  board calibration/LEDs and board-specific settings or sounds.

## First increment acceptance

- [x] Desktop phone frame with the actual interactive game inside.
- [x] Phone layout fills the viewport without a decorative bezel.
- [x] Home, Game, Settings, Back and Return to game work without reloading the engine.
- [x] Diagnostics move into Settings; the game remains the primary experience.
- [x] 5M CPU and current game rules/sampling remain unchanged.
- [x] Verify desktop/narrow layouts and real navigation with a loaded engine.
- [x] Publish and verify the public route.

Future app-source/shared-tool changes must follow their own Stable/Preview
alignment and release procedures. This website increment changes neither app
checkout nor app release gates and needs no companion app port.

Verification on desktop Chrome: a real 5M CPU reply, then Game → Settings → Game
→ Home → Settings → Home → Return to game preserved `1. e4 d6`, with one engine
session and one game. Checked desktop framing plus 390×844 Home and 320×740 Game;
both narrow layouts had no horizontal page overflow. These are resized desktop
checks, not a substitute for testing on a physical phone. Existing research,
site/link, inference and chess/policy checks passed. The worker was stopped after
the local check; persistent download saving was disabled for QA.

Published source `bcacf6d1c1f3a8d860381e71c6b572ad40322300` passed
[check and deploy](https://github.com/Dash1971/mobilemaia.org/actions/runs/40472578243).
Public `/play/`, CSS and JavaScript returned HTTP 200 and matched local bytes.
Live public play returned `1. e4 e6`; Settings → Game → Home → Return to game
preserved those moves, with one session and one game. First network startup was
17.4 s and the reply inference 164 ms on this desktop run; these are observations,
not phone performance claims or a controlled startup comparison.

Cleanup: stopped both local/public test workers, closed the test tab, reset the
temporary viewport and stopped the preview server. No model/runtime files,
build intermediates or browser download-cache entries were created on disk by
this increment; QA used in-memory downloads with saving disabled. Existing
shared caches and other tasks' files were left in place. Volume free space was
73,788,424,192 bytes at start and 51,521,380,352 bytes at the completion check;
the task created only compact source/documentation changes, so that volume-wide
change is not attributed to this work. No bulk paths needed removal or retention.

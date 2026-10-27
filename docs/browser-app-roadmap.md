# Mobile Maia browser edition

Updated 2026-10-27. The requirement is the Mobile Maia app running in the browser,
with a phone frame on desktop and full viewport on phones. The earlier independent
HTML/JavaScript screen recreation was rejected and has been replaced.

## Shared source now

The site builds the actual Stable 2.5.0 Flutter UI/domain logic from pinned source
`aeea49817c34f48397e910894414c1d8b0352124`. Browser adapters supply CPU inference,
Stockfish UCI, IndexedDB files, preferences, downloads, clipboard, sounds and wake
lock. Canonical analysis, board/editor/settings, game review and translations are
hash-checked unchanged. Native APK/release procedures remain unchanged; there is
no shared Stable/Preview tooling change to port.

Implemented app surfaces include Home, Game, Settings, Analysis Board, Board
Editor, Recent games and Game Review. The browser uses 5M CPU and Stockfish Lite,
so evaluations and classifications can differ from Android's larger engines.
Eboard controls are excluded. See [implementation/verification](browser-native-2026-10-27.md).

## Remaining increments

1. Test physical Android/iOS phones: cold/cached startup, drag/touch, audio,
   memory, background/reload recovery, storage eviction and review responsiveness.
   Resized desktop checks do not establish physical-phone performance.
2. Expose an explicit full-model selector/download flow, with size, progress,
   cancel/retry and memory limits. `?model=79m` currently selects the existing
   experimental full-model path; 79M phone download reliability remains unresolved.
3. Add an installable/offline PWA shell with scoped update/cache safety. No service
   worker is installed by this increment. Keep games/settings safe across updates.
4. Measure and reduce Flutter shell/model cold startup without changing app
   presentation or chess behavior. Review accessibility and browser navigation.
5. Self-host Flutter’s missing-script/symbol fallback fonts; verify all app
   languages and document font downloads until that is complete.
6. Add repeatable browser integration coverage and compare representative engine
   and game-review results against native fixtures, disclosing model differences.

The homepage and research remain plain static HTML. Future app-source changes
must deliberately update the pinned app commit and guarded browser boundaries;
do not independently recreate its widgets, labels, board styling or engine rows.

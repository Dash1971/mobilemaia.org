#!/usr/bin/env python3
"""Prepare the actual pinned Flutter app with narrow browser platform adapters."""
import argparse, hashlib, json, pathlib, shutil, subprocess, tarfile, io
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE='aeea49817c34f48397e910894414c1d8b0352124'
PATHS=['lib','third_party/chessground','assets','pubspec.yaml','pubspec.lock','LICENSE','THIRD_PARTY_NOTICES.md','l10n.yaml','analysis_options.yaml']
def prepare(source,output,flutter):
    if output.exists():
        raise ValueError('Use a new task-owned output directory.')
    output.mkdir(parents=True)
    archive=subprocess.check_output(['git','-C',str(source),'archive',SOURCE,'--',*PATHS])
    tarfile.open(fileobj=io.BytesIO(archive)).extractall(output,filter='data')
    originals={p.relative_to(output).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (output/'lib').rglob('*.dart')}
    for file in (ROOT/'browser-app/platform').glob('*.dart'):
        target=output/'lib/browser'/file.name;target.parent.mkdir(exist_ok=True);shutil.copyfile(file,target)
    def patch(name,old,new,count=1):
        path=output/name; text=path.read_text()
        if text.count(old)!=count: raise ValueError(f'{name}: expected {count} occurrences of {old!r}, got {text.count(old)}')
        path.write_text(text.replace(old,new))
    patch('lib/main.dart',"import 'dart:io';","import 'browser/io.dart';\nimport 'browser/bridge.dart';\nimport 'browser/settings.dart';")
    patch('lib/main.dart',"import 'package:multistockfish/multistockfish.dart';","import 'browser/stockfish.dart';")
    patch('lib/main.dart','        LicenseRegistry,','        LicenseRegistry,\n        TargetPlatform,')
    patch('lib/main.dart','  WidgetsFlutterBinding.ensureInitialized();','  WidgetsFlutterBinding.ensureInitialized();\n  reportBrowserCompiler();\n  SharedPreferences.setPrefix(browserPreferencePrefix);')
    patch('lib/main.dart',"const maiaEngineChannel = MethodChannel('maia_chess/engine');","final MethodChannel maiaEngineChannel = BrowserMaiaChannel();")
    patch('lib/src/app_appearance.dart','  return ThemeData(\n','  return ThemeData(\n    platform: TargetPlatform.android,\n')
    patch('lib/src/app_appearance.dart', '  static Future<AppDynamicColors?> _readSystemColors() async {', '  static Future<AppDynamicColors?> _readSystemColors() async {\n    if (Platform.isBrowser) return null;')
    patch('lib/src/app_appearance.dart', '              controller.dynamicColors == null\n                  ? strings.appearanceSystemColorsUnavailable', "              Platform.isBrowser\n                  ? 'Wallpaper-based system colors are not available in a browser. Choose System default above to follow light/dark mode.'\n                  : controller.dynamicColors == null\n                  ? strings.appearanceSystemColorsUnavailable")
    patch('lib/src/play.dart', '    if (_storageBlocked || _startingGame || !mounted) return;', "    if (_storageBlocked || _startingGame || !mounted) return;\n    if (Platform.isBrowser) unawaited(maiaEngineChannel.invokeMethod<void>('prepare').catchError((Object error, StackTrace stack) => AppDiagnostics.record('browser-maia-prepare', error, stack)));")
    patch('lib/src/play.dart', '              if (AppLanguageSettings.maybeOf(context)\n', '              if (Platform.isBrowser) ...[const BrowserAppSettings(), const SizedBox(height: 8)],\n              if (AppLanguageSettings.maybeOf(context)\n')
    patch('lib/src/sound_effect.dart',"static const _channel = MethodChannel('maia_chess/sound_effect');","static final MethodChannel _channel = BrowserMaiaChannel('maia_chess/sound_effect');")
    patch('lib/src/active_session_store.dart','Platform.isAndroid || _testRepository != null','Platform.isBrowser || Platform.isAndroid || _testRepository != null')
    patch('lib/src/diagnostics.dart',"    if (!Platform.isAndroid) return ['platform=${Platform.operatingSystem}'];",'''    if (Platform.isBrowser) {
      final lines = ['platform=browser', 'model=$browserModelName', 'backend=onnx-web-wasm', 'storage=IndexedDB'];
      try {
        final runtime = await maiaEngineChannel.invokeMethod<Object?>('systemDiagnostics');
        lines.add('browserRuntime=${jsonEncode(runtime)}');
      } catch (error) { lines.add('browserRuntime=unavailable ($error)'); }
      return lines;
    }
    if (!Platform.isAndroid) return ['platform=${Platform.operatingSystem}'];''')
    patch('lib/src/play.dart',"            SwitchListTile(\n              key: const ValueKey('home-chessnut-toggle'),","            if (!Platform.isBrowser) SwitchListTile(\n              key: const ValueKey('home-chessnut-toggle'),")
    patch('lib/src/play.dart',"              _settingsSection(\n                title: 'Chessnut',","              if (!Platform.isBrowser) _settingsSection(\n                title: 'Chessnut',")
    patch('lib/src/play.dart',"'Maia-3 79M ($_elo)'","'Maia-3 $browserModelName ($_elo)'",2)
    for path in (output/'lib/src').glob('*.dart'):
        text=path.read_text().replace('Isolate.run(', 'runBrowserTask(').replace("'onnx-android'", "'onnx-web-wasm'")
        path.write_text(text)
    patch('lib/src/review_widgets.dart',"    final job = MoveClassificationJob._(ReceivePort());",'''    if (Platform.isBrowser) {
      final job = MoveClassificationJob._(null);
      job._started.complete();
      unawaited(Future<void>(() {
        if (!job._cancelled) {
          try {
            final cache = Map<String,int>.of(materialCache ?? const {});
            final result = MoveClassifier.classify(scores:scores,positions:positions,uciMoves:uciMoves,requireReliableComparisons:requireReliableComparisons,materialCache:cache);
            job._materialCache = Map.unmodifiable(cache);
            job._result.complete(result);
          } catch(error,stack) { if(!job._result.isCompleted) job._result.completeError(error,stack); }
        }
        job._finish();
      }));
      return job;
    }
    final job = MoveClassificationJob._(ReceivePort());''')
    patch('pubspec.yaml','    - assets/models/maia3-79m.onnx\n','')
    (output/'assets/models/maia3-79m.onnx').unlink(missing_ok=True)
    fonts=flutter/'bin/cache/artifacts/material_fonts'
    fontyaml='    - family: Roboto\n      fonts:\n'
    for suffix,weight in [('Thin',100),('Light',300),('Regular',400),('Medium',500),('Bold',700),('Black',900)]:
        name=f'Roboto-{suffix}.ttf';shutil.copyfile(fonts/name,output/'assets/fonts'/name)
        fontyaml+=f'        - asset: assets/fonts/{name}\n          weight: {weight}\n'
    patch('pubspec.yaml','    - family: LichessIcons',fontyaml+'    - family: LichessIcons')
    for licence in fonts.glob('*LICENSE*'):
        if 'Roboto' in licence.name: shutil.copyfile(licence,output/'assets/fonts'/licence.name)
    (output/'lib/browser_entry.dart').write_text("import 'main.dart' as app;\nFuture<void> main() => app.main();\n")
    web=output/'web';web.mkdir()
    (web/'index.html').write_text('''<!DOCTYPE html><html lang="en"><head><base href="$FLUTTER_BASE_HREF"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"><meta name="theme-color" content="#101610"><title>Mobile Maia</title><link rel="manifest" href="/play/manifest.webmanifest"><link rel="apple-touch-icon" href="/play/icons/icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Mobile Maia"><style>html,body{margin:0;width:100%;height:100%;background:#101610;color:#dce4d9;font-family:Roboto,Arial,sans-serif}</style></head><body><script type="module" src="../native/platform.mjs"></script></body></html>''')
    changed={name for name,digest in originals.items() if hashlib.sha256((output/name).read_bytes()).hexdigest()!=digest}
    ui_files=['lib/src/analysis_board.dart','lib/src/board_editor.dart','lib/src/board_preferences.dart','lib/src/board_styles.dart','lib/src/review.dart','lib/src/settings_widgets.dart','lib/src/maia.dart','lib/src/maia_play_settings.dart']
    ui_files += [name for name in originals if name.startswith('lib/l10n/')]
    for name in ui_files:
        if name in changed: raise ValueError(f'Canonical UI/logic was modified: {name}')

    (output/'browser-source.json').write_text(json.dumps({'source':SOURCE,'sourceRepository':'Dash1971/maia-chess-android','modifiedPlatformBoundaries':sorted(changed),'unchangedDartFiles':len(originals)-len(changed),'unchangedUiAndLogic':{name:originals[name] for name in ui_files}},indent=2)+'\n')
    print((output/'browser-source.json').read_text())
if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('--source',required=True,type=pathlib.Path);args.add_argument('--output',required=True,type=pathlib.Path);args.add_argument('--flutter',required=True,type=pathlib.Path);a=args.parse_args();prepare(a.source.resolve(),a.output.resolve(),a.flutter.resolve())

// SPDX-License-Identifier: AGPL-3.0-only
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/browser/strings.dart';

void main() {
  Widget localized(Locale locale, WidgetBuilder builder) => MaterialApp(
    locale: locale,
    supportedLocales: const [
      Locale('en'), Locale('de'), Locale('es'), Locale('fr'), Locale('hi'),
      Locale('ja'), Locale('ko'), Locale('pt'), Locale('ru'), Locale('zh'),
    ],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: Builder(builder: builder),
  );

  testWidgets('browser copy follows language changes without restarting the app', (tester) async {
    final locale = ValueNotifier(const Locale('en'));
    addTearDown(locale.dispose);
    await tester.pumpWidget(ValueListenableBuilder<Locale>(
      valueListenable: locale,
      builder: (context, value, child) => localized(value, (context) {
        final strings = BrowserStrings.of(context);
        return Scaffold(body: SingleChildScrollView(child: Column(children: [
          Text(strings.installAndOffline), Text(strings.saveOffline),
          Text(strings.downloadHelp), Text(strings.installHelp),
          Text(strings.systemColorsUnavailable('デバイスの設定に従う')), Text(strings.updateReady),
          Text(strings.phase('Initializing Maia…')),
        ])));
      }),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Install and offline'), findsOneWidget);
    locale.value = const Locale('ja');
    await tester.pumpAndSettle();
    expect(find.text('Install and offline'), findsNothing);
    expect(find.text('インストールとオフライン利用'), findsOneWidget);
    expect(find.text('オフライン用に保存'), findsOneWidget);
    expect(find.text('Maiaを初期化中…'), findsOneWidget);
    expect(find.textContaining('5Mモデルのエンジン関連ファイル'), findsOneWidget);
    expect(find.textContaining('Safariの共有メニュー'), findsOneWidget);
    expect(find.textContaining('ブラウザーでは壁紙'), findsOneWidget);
    expect(find.textContaining('更新の準備ができました'), findsOneWidget);
    locale.value = const Locale('en');
    await tester.pumpAndSettle();
    expect(find.text('Install and offline'), findsOneWidget);
    expect(find.text('インストールとオフライン利用'), findsNothing);
  });

  testWidgets('every supported language translates offline progress and error UI', (tester) async {
    const phases = [
      'Saving the app…', 'Saving Stockfish…', 'Ready for offline play and analysis.',
      'Maia is ready.', 'Initializing Maia…', 'Downloading and checking Maia and its runtime…',
    ];
    for (final language in ['de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh']) {
      late BrowserStrings strings;
      await tester.pumpWidget(localized(Locale(language), (context) {
        strings = BrowserStrings.of(context);
        return const SizedBox();
      }));
      await tester.pumpAndSettle();
      for (final phase in phases) {
        expect(strings.phase(phase), isNot(phase), reason: '$language: $phase');
        expect(strings.phase(phase), isNotEmpty);
      }
      expect(strings.phase(null), strings.preparingOffline);
      expect(strings.phase('unexpected protocol value'), strings.preparingOffline);
      expect(strings.offlineError, isNot(startsWith('Offline setup failed')));
      expect(strings.technicalDetails, isNot('Technical details'));
    }
  });
}

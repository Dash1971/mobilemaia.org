#!/usr/bin/env python3
"""Validate web-only catalogs and generate strings in the disposable web export."""
import argparse
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'browser-app/l10n.json'
LANGUAGES = {'en', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh'}
KEYS = set('''installAndOffline installTitle installHelp ok preparingOffline
offlineReady shellReady savePrompt installed standaloneHelp offlinePlay
checkOfflineFiles saveOffline downloadHelp updateReady offlineError technicalDetails
systemColorsUnavailable savingApp savingStockfish maiaReady initializingMaia
downloadingMaia'''.split())


def catalogs():
    data = json.loads(CATALOG.read_text())
    if set(data) != LANGUAGES:
        raise ValueError('Browser catalogs must cover every supported app language.')
    for language, messages in data.items():
        if set(messages) != KEYS:
            raise ValueError(f'{language}: missing/unknown browser translation keys: {KEYS ^ set(messages)}')
        if any(not isinstance(value, str) or not value.strip() for value in messages.values()):
            raise ValueError(f'{language}: empty browser translation')
        for key, value in messages.items():
            expected = ['systemDefault'] if key == 'systemColorsUnavailable' else []
            if re.findall(r'\{([^{}]+)\}', value) != expected:
                raise ValueError(f'{language}/{key}: invalid translation placeholders')
    return data


def dart_string(value):
    # JSON double-quoted strings also work in Dart once interpolation is escaped.
    return json.dumps(value, ensure_ascii=False).replace('$', r'\$')


def prepare_localizations(app):
    data = catalogs()
    source_languages = {path.stem.removeprefix('app_') for path in (app / 'lib/l10n').glob('app_*.arb')}
    if source_languages != LANGUAGES:
        raise ValueError('App languages changed; reconcile the browser translation catalogs.')
    entries = '\n'.join(
        f'  {dart_string(language)}: {{\n' + ''.join(
            f'    {dart_string(key)}: {dart_string(value)},\n' for key, value in messages.items()) + '  },'
        for language, messages in sorted(data.items()))
    getters = '\n'.join(f"  String get {key} => _messages['{key}']!;" for key in sorted(KEYS - {'systemColorsUnavailable'}))
    text = '''// SPDX-License-Identifier: AGPL-3.0-only
// Generated from browser-app/l10n.json; never edit native app catalogs.
import 'package:flutter/widgets.dart';

class BrowserStrings {
  BrowserStrings._(String language) : _messages = _catalogs[language] ?? _catalogs['en']!;
  final Map<String, String> _messages;
  // Depending on Localizations makes an in-app language change rebuild this UI.
  static BrowserStrings of(BuildContext context) =>
      BrowserStrings._(Localizations.localeOf(context).languageCode);
GETTERS
  String systemColorsUnavailable(String systemDefault) =>
      _messages['systemColorsUnavailable']!.replaceAll('{systemDefault}', systemDefault);

  // Existing engine status values are protocol/diagnostic text. Translate them
  // at the presentation boundary; keep engine behavior and diagnostics intact.
  String phase(String? value) => switch (value) {
    'Saving the app…' => savingApp,
    'Saving Stockfish…' => savingStockfish,
    'Ready for offline play and analysis.' => offlineReady,
    'Maia is ready.' => maiaReady,
    'Initializing Maia…' => initializingMaia,
    'Downloading and checking Maia and its runtime…' => downloadingMaia,
    _ => preparingOffline,
  };
}

const _catalogs = <String, Map<String, String>>{
ENTRIES
};
'''.replace('GETTERS', getters).replace('ENTRIES', entries)
    target = app / 'lib/browser/strings.dart'
    target.parent.mkdir(exist_ok=True)
    target.write_text(text)
    return {'languages': sorted(data), 'catalogSha256': hashlib.sha256(CATALOG.read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    catalogs()
    print('PASS: complete browser/PWA translations for all 10 app languages.')

// SPDX-License-Identifier: AGPL-3.0-only
import 'dart:async';
import 'package:flutter/material.dart';
import 'bridge.dart';

// Browser-only capabilities belong in Settings alongside the original app UI.
class BrowserAppSettings extends StatefulWidget {
  const BrowserAppSettings({super.key});
  @override
  State<BrowserAppSettings> createState() => _BrowserAppSettingsState();
}
class _BrowserAppSettingsState extends State<BrowserAppSettings> {
  Timer? _timer;
  Map<dynamic, dynamic> _status = {};
  bool _saving = false;
  bool _refreshing = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _refresh());
  }
  Future<void> _refresh() async {
    if (_refreshing) return;
    _refreshing = true;
    try {
      final status = await BrowserMaiaChannel().invokeMethod<Map>('pwaStatus');
      if (mounted) setState(() => _status = status ?? {});
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { _refreshing = false; }
  }
  @override
  void dispose() { _timer?.cancel(); super.dispose(); }
  Future<void> _install() async {
    bool? installed;
    try { installed = await BrowserMaiaChannel().invokeMethod<bool>('pwaInstall'); }
    catch (error) { if (mounted) setState(() => _error = '$error'); return; }
    if (installed != true && mounted) {
      await showDialog<void>(context: context, builder: (context) => AlertDialog(
        title: const Text('Install Mobile Maia'),
        content: const Text('Use your browser’s menu and choose Install app or Add to Home Screen. On iPhone or iPad, use Safari’s Share menu → Add to Home Screen. If already installed, open Mobile Maia from its home-screen icon.'),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
      ));
    }
    await _refresh();
  }
  Future<void> _save() async {
    setState(() { _saving = true; _error = null; });
    try { await BrowserMaiaChannel().invokeMethod<void>('prepareOffline'); }
    catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _saving = false); await _refresh(); }
  }
  @override
  Widget build(BuildContext context) {
    final offline = _status['offlineReady'] == true;
    final progress = (_status['downloadProgress'] as num?)?.toDouble();
    final text = _saving
        ? (_status['phase'] as String? ?? 'Preparing offline play…')
        : offline ? 'Ready for offline play and analysis.'
        : _status['shellReady'] == true ? 'App saved. Save engines below to play offline.'
        : _status['error'] as String? ?? 'Save the app and engines to play offline.';
    return Card(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const ListTile(leading: Icon(Icons.install_mobile), title: Text('Install and offline', style: TextStyle(fontWeight: FontWeight.w700))),
      const Divider(height: 1),
      ListTile(
        title: Text(_status['installed'] == true ? 'Mobile Maia is installed' : 'Install Mobile Maia'),
        subtitle: const Text('Open from your home screen in its own app window.'),
        trailing: _status['installed'] == true ? const Icon(Icons.check) : null,
        onTap: _status['installed'] == true ? null : _install,
      ),
      ListTile(title: const Text('Offline play'), subtitle: Text(text)),
      if (_saving) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: LinearProgressIndicator(value: progress)),
      Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 12), child: OutlinedButton.icon(
        onPressed: _saving ? null : _save,
        icon: Icon(offline ? Icons.refresh : Icons.download_for_offline_outlined),
        label: Text(offline ? 'Check offline files' : 'Save for offline use'),
      )),
      const Padding(padding: EdgeInsets.fromLTRB(16, 0, 16, 16), child: Text('Downloads the selected Maia model, CPU runtime and Stockfish. The 5M engine downloads total about 38 MB, plus about 38 MB for the app and its board/piece choices. Browser storage can be cleared or evicted; export important games.')),
      if (_status['updating'] == true) const Padding(padding: EdgeInsets.fromLTRB(16, 0, 16, 16), child: Text('An update is ready. Finish your game, then close all Mobile Maia windows and tabs and reopen.')),
      if (_error != null) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Text(_error!, semanticsLabel: 'Offline setup error: $_error')),
    ]));
  }
}

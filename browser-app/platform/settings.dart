// SPDX-License-Identifier: AGPL-3.0-only
import 'dart:async';
import 'package:flutter/material.dart';
import 'bridge.dart';
import 'strings.dart';

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
      final strings = BrowserStrings.of(context);
      await showDialog<void>(context: context, builder: (context) => AlertDialog(
        title: Text(strings.installTitle),
        content: Text(strings.installHelp),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text(strings.ok))],
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
    final strings = BrowserStrings.of(context);
    final offline = _status['offlineReady'] == true;
    final progress = (_status['downloadProgress'] as num?)?.toDouble();
    final statusError = _status['error'] as String?;
    final error = _error ?? (statusError?.isNotEmpty == true ? statusError : null);
    final text = _saving
        ? strings.phase(_status['phase'] as String?)
        : offline ? strings.offlineReady
        : _status['shellReady'] == true ? strings.shellReady
        : strings.savePrompt;
    return Card(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ListTile(leading: const Icon(Icons.install_mobile), title: Text(strings.installAndOffline, style: const TextStyle(fontWeight: FontWeight.w700))),
      const Divider(height: 1),
      ListTile(
        title: Text(_status['installed'] == true ? strings.installed : strings.installTitle),
        subtitle: Text(strings.standaloneHelp),
        trailing: _status['installed'] == true ? const Icon(Icons.check) : null,
        onTap: _status['installed'] == true ? null : _install,
      ),
      ListTile(title: Text(strings.offlinePlay), subtitle: Text(text)),
      if (_saving) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: LinearProgressIndicator(value: progress)),
      Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 12), child: OutlinedButton.icon(
        onPressed: _saving ? null : _save,
        icon: Icon(offline ? Icons.refresh : Icons.download_for_offline_outlined),
        label: Text(offline ? strings.checkOfflineFiles : strings.saveOffline),
      )),
      Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Text(strings.downloadHelp)),
      if (_status['updating'] == true) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Text(strings.updateReady)),
      if (error != null) ...[
        Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 8), child: Text(strings.offlineError)),
        // Runtime errors are diagnostic details, not untranslated UI copy.
        ExpansionTile(title: Text(strings.technicalDetails), children: [
          Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: SelectableText(error)),
        ]),
      ],
    ]));
  }
}

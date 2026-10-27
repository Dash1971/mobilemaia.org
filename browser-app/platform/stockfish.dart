// SPDX-License-Identifier: AGPL-3.0-only
import 'dart:async';
import 'dart:js_interop';
import 'bridge.dart';

// The app's existing StockfishAnalyzer, queue, settings and widgets are reused.
class Stockfish {
  Stockfish._();
  final _output = StreamController<String>.broadcast(sync: true);
  late BrowserUci _engine;
  Stream<String> get stdout => _output.stream;
  set stdin(String command) => _engine.post(command.toJS);
  static Future<Stockfish> create() async {
    final instance = Stockfish._();
    instance._engine = await browserHost.createStockfish(((JSString line) {
      if (!instance._output.isClosed) instance._output.add(line.toDart);
    }).toJS).toDart;
    return instance;
  }
  Future<void> dispose() async { _engine.close(); await _output.close(); }
}

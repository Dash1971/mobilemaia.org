// SPDX-License-Identifier: AGPL-3.0-only
import 'dart:async';
import 'dart:js_interop';
import 'package:flutter/services.dart';

@JS('mobileMaiaNative')
external BrowserHost get browserHost;
extension type BrowserHost(JSObject _) implements JSObject {
  external JSPromise<JSAny?> invoke(JSString channel, JSString method, JSAny? arguments);
  external JSPromise<BrowserUci> createStockfish(JSFunction listener);
  external BrowserFiles get files;
  external JSString get modelName;
  external JSString get preferencePrefix;
}
extension type BrowserUci(JSObject _) implements JSObject {
  external void post(JSString command);
  external void close();
}
extension type BrowserFiles(JSObject _) implements JSObject {
  external JSString? get(JSString key);
  external void put(JSString key, JSString value);
  external void remove(JSString key);
  external JSArray<JSString> keys();
}

class BrowserMaiaChannel extends MethodChannel {
  BrowserMaiaChannel([super.name = 'maia_chess/engine']);
  Future<dynamic> Function(MethodCall)? _handler;
  @override
  void setMethodCallHandler(Future<dynamic> Function(MethodCall)? handler) { _handler = handler; }
  @override
  Future<T?> invokeMethod<T>(String method, [dynamic arguments]) async {
    final value = (await browserHost.invoke(name.toJS, method.toJS, (arguments as Object?).jsify()).toDart)?.dartify();
    if (name == 'maia_chess/sound_effect' && method == 'load') {
      await _handler?.call(MethodCall('onLoadComplete', arguments));
    }
    return value as T?;
  }
}

// Browsers have no Dart isolates. Yield before the unchanged pure-Dart work,
// then await durable writes made by the browser file adapter.
Future<T> runBrowserTask<T>(FutureOr<T> Function() action) async {
  final result = await Future<T>(action);
  await browserHost.invoke('storage'.toJS, 'flush'.toJS, null).toDart;
  return result;
}
String get browserModelName => browserHost.modelName.toDart;

String get browserPreferencePrefix => browserHost.preferencePrefix.toDart;

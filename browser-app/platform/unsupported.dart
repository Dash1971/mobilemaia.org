// SPDX-License-Identifier: AGPL-3.0-only
import 'package:flutter/material.dart';
Future<void> main() async {
  runApp(const MaterialApp(
    home: Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Mobile Maia needs a browser with WebAssembly GC support. Update your browser, or use the Android app.'),
        ),
      ),
    ),
  ));
}

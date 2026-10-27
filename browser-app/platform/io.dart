// SPDX-License-Identifier: AGPL-3.0-only
// Narrow filesystem adapter for the app's existing session/sampling repository.
// Values live in IndexedDB. Async operations and runBrowserTask await durability.
import 'dart:convert';
import 'dart:js_interop';
import 'dart:typed_data';
import 'bridge.dart';

class Platform {
  static const isAndroid = false;
  static const isBrowser = true;
  static const operatingSystem = 'browser';
}
class OSError {
  const OSError([this.message = '', this.errorCode = -1]);
  final String message; final int errorCode;
}
class FileSystemException implements Exception {
  const FileSystemException([this.message = '', this.path = '', this.osError]);
  final String message, path; final OSError? osError;
  @override String toString() => 'FileSystemException: $message ($path)';
}
String _normalize(String value) {
  final parts = <String>[];
  for (final part in value.split('/')) {
    if (part.isEmpty || part == '.') continue;
    if (part == '..') { if (parts.isNotEmpty) parts.removeLast(); }
    else parts.add(part);
  }
  return '/${parts.join('/')}';
}
Map<String,dynamic>? _read(String path) {
  final value = browserHost.files.get(path.toJS)?.toDart;
  return value == null ? null : (jsonDecode(value) as Map).cast<String,dynamic>();
}
void _write(String path, String kind, String text) => browserHost.files.put(path.toJS, jsonEncode({'kind':kind,'text':text,'modified':DateTime.now().millisecondsSinceEpoch}).toJS);
Future<void> _flush() async { await browserHost.invoke('storage'.toJS,'flush'.toJS,null).toDart; }
class FileStat {
  FileStat(this.modified); final DateTime modified;
}
abstract class FileSystemEntity {
  FileSystemEntity(String path): path = _normalize(path);
  final String path;
  Uri get uri => Uri.file(path);
  Directory get parent => Directory(path.substring(0,path.lastIndexOf('/')));
  bool existsSync() => _read(path) != null;
  Future<bool> exists() async => existsSync();
  FileStat statSync() => FileStat(DateTime.fromMillisecondsSinceEpoch((_read(path)?['modified'] as int?) ?? 0));
  Future<FileStat> stat() async => statSync();
}
class Directory extends FileSystemEntity {
  Directory(super.path);
  void createSync({bool recursive = false}) {
    if (existsSync()) return;
    if (recursive && path != '/' && parent.path != path) parent.createSync(recursive:true);
    _write(path,'directory','');
  }
  Future<Directory> create({bool recursive = false}) async { createSync(recursive:recursive); await _flush(); return this; }
  List<FileSystemEntity> listSync({bool recursive = false, bool followLinks = true}) {
    if (!existsSync()) return [];
    final prefix = path == '/' ? '/' : '$path/';
    return browserHost.files.keys().toDart.map((x)=>x.toDart)
      .where((key)=>key.startsWith(prefix) && key != path && (recursive || !key.substring(prefix.length).contains('/')))
      .map((key)=>_read(key)?['kind'] == 'directory' ? Directory(key) : File(key)).toList();
  }
  Stream<FileSystemEntity> list({bool recursive = false,bool followLinks = true}) async* { yield* Stream.fromIterable(listSync(recursive:recursive,followLinks:followLinks)); }
  void deleteSync({bool recursive = false}) {
    final entries = listSync(recursive:true);
    if (!recursive && entries.isNotEmpty) throw FileSystemException('Directory not empty',path,const OSError('',39));
    for (final entry in entries) browserHost.files.remove(entry.path.toJS);
    browserHost.files.remove(path.toJS);
  }
  Future<Directory> delete({bool recursive = false}) async { deleteSync(recursive:recursive); await _flush(); return this; }
}
class FileMode { const FileMode._(); static const write=FileMode._(); }
class File extends FileSystemEntity {
  File(super.path);
  String readAsStringSync() {
    final value = _read(path);
    if (value == null) throw FileSystemException('No such file',path,const OSError('',2));
    return value['text'] as String;
  }
  Future<String> readAsString() async => readAsStringSync();
  Uint8List readAsBytesSync() => Uint8List.fromList(utf8.encode(readAsStringSync()));
  Future<Uint8List> readAsBytes() async => readAsBytesSync();
  int lengthSync() => readAsBytesSync().length;
  Future<int> length() async => lengthSync();
  void writeAsStringSync(String text,{bool flush = false}) { parent.createSync(recursive:true); _write(path,'file',text); }
  Future<File> writeAsString(String text,{bool flush = false}) async { writeAsStringSync(text); await _flush(); return this; }
  File renameSync(String target) {
    final text = readAsStringSync(), destination=File(target);
    destination.writeAsStringSync(text); browserHost.files.remove(path.toJS); return destination;
  }
  Future<File> rename(String target) async { final result=renameSync(target); await _flush(); return result; }
  void deleteSync() { browserHost.files.remove(path.toJS); }
  Future<File> delete() async { deleteSync(); await _flush(); return this; }
  Stream<List<int>> openRead([int? start,int? end]) async* { final bytes=readAsBytesSync(); yield bytes.sublist(start ?? 0,end); }
  BrowserIOSink openWrite() => BrowserIOSink(this);
  RandomAccessFile openSync({FileMode? mode}) { writeAsStringSync(''); return RandomAccessFile(this); }
}
class RandomAccessFile {
  RandomAccessFile(this.file); final File file;
  void writeStringSync(String value) => file.writeAsStringSync(file.readAsStringSync()+value);
  void writeFromSync(List<int> bytes,[int start=0,int? end]) => writeStringSync(utf8.decode(bytes.sublist(start,end)));
  void writeByteSync(int byte) => writeFromSync([byte]);
  void flushSync() {}
  void closeSync() {}
}

class BrowserIOSink {
  BrowserIOSink(this.file); final File file; final _buffer=StringBuffer();
  void write(Object? value) => _buffer.write(value);
  Future<void> flush() async { await file.writeAsString(_buffer.toString(),flush:true); }
  Future<void> close() => flush();
}

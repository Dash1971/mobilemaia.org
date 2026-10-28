#!/usr/bin/env python3
"""Patch a disposable, hash-pinned dartchess copy; never modify the Pub cache."""
import hashlib, json, pathlib, re, shutil
from urllib.parse import urljoin, urlparse, unquote

ROOT = pathlib.Path(__file__).resolve().parents[1]
UPSTREAM_TREE = '75d3bb8787ed631a69ce4d3ea231241582501f9a74c16dc46e824a3acce490e9'

def tree_hash(root):
    digest = hashlib.sha256()
    for path in sorted([*(root/'lib').rglob('*.dart'), root/'pubspec.yaml', root/'LICENSE']):
        digest.update(path.relative_to(root).as_posix().encode()); digest.update(path.read_bytes())
    return digest.hexdigest()

def prepare_chess(app):
    config_path = app/'.dart_tool/package_config.json'
    config = json.loads(config_path.read_text())
    package = next(p for p in config['packages'] if p['name'] == 'dartchess')
    original = pathlib.Path(unquote(urlparse(urljoin(config_path.as_uri(), package['rootUri'])).path))
    if tree_hash(original) != UPSTREAM_TREE:
        raise ValueError('dartchess source differs from reviewed 0.13.1; review the adapter before upgrading.')
    target = app/'third_party/dartchess-browser'
    if target.exists(): raise ValueError('Use a fresh prepared project.')
    shutil.copytree(original/'lib', target/'lib')
    for name in ['pubspec.yaml', 'LICENSE', 'README.md']:
        shutil.copyfile(original/name, target/name)
    native = target/'lib/src/square_set_native.dart'
    native.write_text((target/'lib/src/square_set.dart').read_text().replace(
        'extension type const SquareSet(int value) {',
        'extension type const SquareSet(int value) {\n  const SquareSet.fromHalves(int low, int high) : value = (high << 32) | low;'))
    (target/'lib/src/square_set.dart').write_text("export 'square_set_native.dart' if (dart.library.js) 'square_set_js.dart';\n")
    shutil.copyfile(ROOT/'browser-app/chess/square_set_js.dart', target/'lib/src/square_set_js.dart')
    # Split constant masks at generation time so neither compiler rounds a literal.
    # Only these two upstream files construct bitboards outside SquareSet itself.
    replacements = {}
    for name in ['board.dart', 'castles.dart']:
        path = target/'lib/src'/name
        def split(match):
            value = int(match[1], 16)
            return f'SquareSet.fromHalves(0x{value & 0xffffffff:08x}, 0x{value >> 32:08x})'
        text, count = re.subn(r'SquareSet\((0x[0-9a-fA-F]+)\)', split, path.read_text())
        expected = {'board.dart': 25, 'castles.dart': 7}[name]
        if count != expected: raise ValueError(f'{name}: expected {expected} masks, got {count}')
        path.write_text(text); replacements[name] = count
    package['rootUri'] = target.as_uri()+'/'
    config_path.write_text(json.dumps(config, indent=2)+'\n')
    source_path = app/'browser-source.json'
    source = json.loads(source_path.read_text())
    source['chessCompatibility'] = {'package':'dartchess 0.13.1', 'upstreamTreeSha256':UPSTREAM_TREE,
        'representation':'native int64 for DartWasm; unsigned 32-bit pair for dart2js',
        'adapterSha256': hashlib.sha256((ROOT/'browser-app/chess/square_set_js.dart').read_bytes()).hexdigest(),
        'splitConstantMasks':replacements,
        'unchangedRules':{name:hashlib.sha256((target/'lib/src'/name).read_bytes()).hexdigest()
            for name in ['attacks.dart','position.dart','setup.dart','pgn.dart','models.dart']}}
    source_path.write_text(json.dumps(source, indent=2)+'\n')
    return original, target

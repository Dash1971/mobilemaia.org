#!/usr/bin/env python3
"""Compare compiled JS chess with untouched upstream VM chess and known perft."""
import argparse, hashlib, json, pathlib, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]

def fixtures(original):
    result = []
    for name, limit, max_depth in [('tricky', 100, 3), ('random', 100, 2), ('chess960', 50, 2)]:
        entries = []; current = None
        for line in (original/f'test/resources/{name}.perft').read_text().splitlines():
            if line.startswith('id '):
                current = {'id': name+'/'+line[3:], 'cases': []}; entries.append(current)
            elif line.startswith('epd '): current['fen'] = line[4:]
            elif line.startswith('perft '):
                _, depth, nodes = line.split()
                if int(depth) <= max_depth: current['cases'].append([int(depth), int(nodes)])
        result.extend(entries[:limit])
    return result

def run(app, original, flutter):
    dart = str(flutter/'bin/dart')
    node = shutil.which('node')
    if not node: raise ValueError('Node.js is required for compiled-JavaScript chess verification.')
    tests = app.parent/'chess-verification'; tests.mkdir()
    config = json.loads((app/'.dart_tool/package_config.json').read_text())
    # Absolute URIs make both temporary package configs independent of location.
    from urllib.parse import urljoin
    for package in config['packages']:
        package['rootUri'] = urljoin((app/'.dart_tool/package_config.json').as_uri(), package['rootUri'])
    upstream = json.loads(json.dumps(config))
    next(p for p in upstream['packages'] if p['name'] == 'dartchess')['rootUri'] = original.as_uri()+'/'
    (tests/'upstream.json').write_text(json.dumps(upstream))
    (tests/'browser.json').write_text(json.dumps(config))
    data = fixtures(original)
    driver = (ROOT/'tools/browser_chess_checks.dart').read_text().replace('__PERFT_FIXTURES__',json.dumps(json.dumps(data)))
    source = tests/'checks.dart'; source.write_text(driver)
    def capture(args): return subprocess.check_output(args, text=True).strip()
    expected = capture([dart, '--packages='+str(tests/'upstream.json'), str(source)])
    native = capture([dart, '--packages='+str(tests/'browser.json'), str(source)])
    if native != expected: raise ValueError('Adapted native chess differs from upstream: '+native+' != '+expected)
    subprocess.run([dart,'compile','js','-O2','--packages='+str(tests/'browser.json'),str(source),'-o',str(tests/'checks.js')], check=True)
    actual = capture([node,'-e',"globalThis.self=globalThis;require(process.argv[1]);",str(tests/'checks.js')])
    if actual != expected: raise ValueError('Compiled JS chess differs from upstream: '+actual+' != '+expected)
    evidence = {'result':'PASS', 'perftPositions':len(data)+1,
        'comparison':'unmodified dartchess VM == adapted VM == compiled dart2js in Node',
        'checks':json.loads(actual), 'driverSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    (app.parent/'chess-verification.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence))

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    for name in ['app','original','flutter']: parser.add_argument('--'+name,required=True,type=pathlib.Path)
    args=parser.parse_args(); run(args.app.resolve(),args.original.resolve(),args.flutter.resolve())

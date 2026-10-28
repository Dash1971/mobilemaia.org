#!/usr/bin/env python3
"""Remove ORT's unused shared-buffer probe from the non-threaded loader only."""
import argparse,hashlib,json,pathlib
PROBE='var SharedArrayBuffer=globalThis.SharedArrayBuffer??(new WebAssembly.Memory({initial:0,maximum:0,shared:!0})).buffer.constructor,'
def finalize(package):
    manifest_path=package/'manifest.json';manifest=json.loads(manifest_path.read_text())
    if manifest['profile']!='maia5m-simd-unshared' or manifest['sharedMemory'] or manifest['threads']:raise ValueError('Only the non-shared CPU profile can remove this probe.')
    for name,pin in manifest['files'].items():
        if pathlib.Path(name).name!=name:raise ValueError('Invalid filename.')
        contents=(package/name).read_bytes()
        if len(contents)!=pin['bytes'] or hashlib.sha256(contents).hexdigest()!=pin['sha256']:raise ValueError('Input package integrity mismatch: '+name)
    path=package/'ort-wasm-simd.mjs';text=path.read_text()
    # No remaining references may depend on this constructor: it must be a dead
    # declaration preserved solely because allocation is a side effect.
    if text.count(PROBE)!=1 or text.count('SharedArrayBuffer')!=2:raise ValueError('Review generated unshared loader before removing its unused probe.')
    original=manifest['files'][path.name].copy()
    text=text.replace(PROBE,'var ');path.write_text(text)
    if 'SharedArrayBuffer' in text:raise ValueError('Unexpected shared-buffer use.')
    manifest['files'][path.name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    manifest['unsharedLoaderCleanup']={'originalLoader':original,
      'processorSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
      'change':'Remove the sole, unused SharedArrayBuffer declaration and zero-page shared-memory probe; Wasm binary unchanged.'}
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('package',type=pathlib.Path);args=parser.parse_args()
    print(json.dumps(finalize(args.package),indent=2))

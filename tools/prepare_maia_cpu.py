#!/usr/bin/env python3
"""Fetch the pinned custom CPU package into owned scratch, never the source tree."""
import hashlib,json,pathlib,shutil,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
PIN=ROOT/'browser-app/runtime/maia5m-cpu.json'
def prepare(scratch):
    if not json.loads((scratch/'owner.json').read_text()).get('owner'):raise ValueError('Owned scratch is required.')
    pin=json.loads(PIN.read_text())
    if pin['sourceCommit']!=json.loads((ROOT/'site/lab/inference/config.json').read_text())['runtime']['sourceCommit']:raise ValueError('Review the ORT source upgrade.')
    if pin['operatorsConfigSha256']!=hashlib.sha256((ROOT/'browser-app/runtime/maia5m-ops.config').read_bytes()).hexdigest():raise ValueError('Operator configuration changed; rebuild CPU package.')
    if pin['unsharedLoaderCleanup']['processorSha256']!=hashlib.sha256((ROOT/'tools/finalize_maia_cpu.py').read_bytes()).hexdigest():raise ValueError('Review the CPU loader postprocessing upgrade.')
    package=scratch/'cpu-runtime';package.mkdir(exist_ok=True)
    for name,asset in pin['files'].items():
        if pathlib.Path(name).name!=name:raise ValueError('Invalid package filename.')
        path=package/name
        if not path.exists():
            if shutil.disk_usage(scratch).free<10*1024**3+asset['bytes']:raise ValueError('Preserve the 10 GiB reserve.')
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(pin['downloadBase']+'/'+name,timeout=60) as response:contents=response.read(asset['bytes']+1)
                    if len(contents)!=asset['bytes'] or hashlib.sha256(contents).hexdigest()!=asset['sha256']:raise ValueError('CPU package integrity mismatch: '+name)
                    path.write_bytes(contents);break
                except OSError:
                    if attempt==2:raise
                    time.sleep(2)
        contents=path.read_bytes()
        if len(contents)!=asset['bytes'] or hashlib.sha256(contents).hexdigest()!=asset['sha256']:raise ValueError('CPU package integrity mismatch: '+name)
    return package,pin
def install(package,pin,deploy):
    directory='play/runtime/maia5m-'+pin['files']['ort-wasm-simd.wasm']['sha256'][:16]
    target=deploy/directory;target.mkdir(parents=True)
    for name in pin['files']:shutil.copyfile(package/name,target/name)
    asset=pin['files']['ort-wasm-simd.wasm']
    runtime={'profile':pin['profile'],'version':pin['version'],'sourceCommit':pin['sourceCommit'],
      'memoryMaximumMiB':256,'sharedMemory':False,'threads':False,
      'wasm':{'url':'/'+directory+'/ort-wasm-simd.wasm',**asset,
              'loader':'/'+directory+'/ort-wasm-simd.mjs'}}
    (deploy/'play/maia-cpu.json').write_text(json.dumps(runtime,indent=2)+'\n')
    return runtime

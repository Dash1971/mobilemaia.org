#!/usr/bin/env python3
"""Build a model-scoped, non-shared ORT CPU runtime in owned Linux scratch."""
import argparse, hashlib, json, os, pathlib, shutil, subprocess, sys, time, venv

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE='6af1a932e2286d5c58166085d24c68783033edee'
EMSDK='4.0.23'
GIB=1024**3

def run(command, cwd=None, env=None):
    child=subprocess.Popen(command,cwd=cwd,env=env)
    try:
        while child.poll() is None:
            if shutil.disk_usage(cwd or ROOT).free < 10*GIB:
                child.terminate();child.wait();raise RuntimeError('Stopping before the 10 GiB disk reserve is consumed.')
            time.sleep(2)
        if child.returncode: raise subprocess.CalledProcessError(child.returncode,command)
    except BaseException:
        if child.poll() is None: child.terminate();child.wait()
        raise

def build(scratch):
    if scratch.exists(): raise ValueError('Use a new task-owned scratch directory.')
    scratch.parent.mkdir(parents=True,exist_ok=True)
    free=shutil.disk_usage(scratch.parent).free
    if free < 18*GIB: raise ValueError('Need expected 8 GiB growth plus 10 GiB reserve.')
    scratch.mkdir();(scratch/'owner.json').write_text(json.dumps({'owner':'Mobile Maia non-shared CPU runtime build','source':SOURCE,'expectedGrowthGiB':8,'reserveGiB':10,'retention':'through artifact verification; runner ephemeral'},indent=2)+'\n')
    env=os.environ.copy();env['GIT_LFS_SKIP_SMUDGE']='1'
    venv.EnvBuilder(with_pip=True).create(scratch/'venv')
    python=str(scratch/'venv/bin/python')
    run([python,'-m','pip','install','--no-cache-dir','flatbuffers==25.9.23','numpy==2.2.6','packaging==25.0'],cwd=scratch,env=env)
    source=scratch/'source';source.mkdir()
    for args in [['init'],['remote','add','origin','https://github.com/microsoft/onnxruntime.git'],
                 ['-c','http.version=HTTP/1.1','fetch','--depth','1','origin',SOURCE],['checkout','--detach','FETCH_HEAD']]:
        run(['git',*args],cwd=source,env=env)
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()==SOURCE
    cmake=source/'cmake/onnxruntime_webassembly.cmake'
    text=cmake.read_text();old='set(MAXIMUM_MEMORY "4294967296")'
    if text.count(old)!=1: raise ValueError('Review the upstream Wasm memory configuration.')
    cmake.write_text(text.replace(old,'set(MAXIMUM_MEMORY "268435456")'))
    config=ROOT/'browser-app/runtime/maia5m-ops.config'
    command=[python,str(source/'tools/ci_build/build.py'),'--config','Release',
      '--build_dir',str(scratch/'build'),'--build_wasm','--enable_wasm_simd',
      '--skip_tests','--disable_wasm_exception_catching','--enable_wasm_api_exception_catching',
      '--disable_rtti','--disable_contrib_ops','--disable_ml_ops',
      '--include_ops_by_config',str(config),'--emsdk_version',EMSDK,'--parallel','4',
      '--cmake_generator','Ninja','--cmake_extra_defines','CMAKE_CXX_FLAGS_RELEASE=-Os -DNDEBUG -Wno-error=pass-failed',
      'CMAKE_C_FLAGS_RELEASE=-Os -DNDEBUG']
    # --enable_wasm_threads is deliberately absent: no shared memory/atomics.
    run(command,cwd=source,env=env)
    output=scratch/'package';output.mkdir()
    for name in ['ort-wasm-simd.mjs','ort-wasm-simd.wasm']:
        source_file=scratch/'build/Release'/name
        if not source_file.is_file(): raise ValueError('Missing '+str(source_file))
        shutil.copyfile(source_file,output/name)
    for name in ['LICENSE','ThirdPartyNotices.txt']:
        shutil.copyfile(ROOT/'site/lab/inference/vendor'/name,output/name)
    shutil.copyfile(config,output/'maia5m-ops.config')
    files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in output.iterdir() if p.is_file()}
    manifest={'runtime':'onnxruntime-web','version':'1.31.1','sourceCommit':SOURCE,
      'emsdkVersion':EMSDK,'profile':'maia5m-simd-unshared','threads':False,'sharedMemory':False,
      'memoryMaximumMiB':256,'operatorsConfigSha256':hashlib.sha256(config.read_bytes()).hexdigest(),
      'recipeSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
      'websiteCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
      'command':command[2:],'files':files}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--scratch',required=True,type=pathlib.Path);args=parser.parse_args()
    build(args.scratch.resolve())

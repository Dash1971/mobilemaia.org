#!/usr/bin/env python3
"""Build canonical Mobile Maia widgets and assemble an immutable Pages bundle."""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess, sys
from prepare_browser_app import ROOT, SOURCE, prepare
GIB=1024**3
SDK='737ba8f885dc774b53b442759999a312c9461e4e'
def digest_tree(path):
    digest=hashlib.sha256()
    for file in sorted(p for p in path.rglob('*') if p.is_file()):
        digest.update(file.relative_to(path).as_posix().encode());digest.update(file.read_bytes())
    return digest.hexdigest()[:16]
def assemble(web,deploy):
    if deploy.exists(): raise ValueError('Deployment output must be new.')
    shutil.copytree(ROOT/'site',deploy)
    app=deploy/'play/app';app.mkdir()
    build=digest_tree(web);bundle=app/f'bundle-{build}';shutil.copytree(web,bundle)
    # The source entry is kept at the route root; every compiled asset is scoped
    # to a content hash so stale fonts/code cannot be mixed after an update.
    index=(bundle/'index.html').read_text();(bundle/'index.html').unlink()
    bootstrap=(bundle/'flutter_bootstrap.js').read_text();(bundle/'flutter_bootstrap.js').unlink()
    match=re.search(r'_flutter\.buildConfig = (\{[^\n]+\});',bootstrap)
    if not match: raise ValueError('Unexpected pinned Flutter bootstrap format.')
    config=json.loads(match[1])
    for entry in config['builds']:
        for key in ['mainWasmPath','jsSupportRuntimePath','mainJsPath']:
            if key in entry: entry[key]=f'bundle-{build}/'+entry[key]
    bootstrap=bootstrap[:match.start(1)]+json.dumps(config,separators=(',',':'))+bootstrap[match.end(1):]
    marker=bootstrap.rindex('_flutter.loader.load(')
    bootstrap=bootstrap[:marker]+f"_flutter.loader.load({{config:{{assetBase:'bundle-{build}/',canvasKitBaseUrl:'bundle-{build}/canvaskit/',forceSingleThreadedSkwasm:true}}}});\n"
    name=f'flutter_bootstrap.{build}.js';(app/name).write_text(bootstrap)
    runtime=hashlib.sha256(b''.join((ROOT/'site/play/native'/f).read_bytes() for f in ['platform.mjs','maia-worker.mjs'])).hexdigest()[:16]
    index=index.replace('</head>',f'<meta name="mobile-maia-bootstrap" content="{name}"><meta name="mobile-maia-asset-base" content="bundle-{build}/"></head>')
    index=index.replace('../native/platform.mjs','../native/platform.mjs?v='+runtime)
    (app/'index.html').write_text(index)
    host=deploy/'play/index.html';host.write_text(host.read_text().replace('__BROWSER_BUILD__',build))
    source=json.loads((web.parent.parent/'browser-source.json').read_text())
    source.update({'bundle':build,'runtime':runtime,'flutterRevision':SDK,'modelDefault':'5m','rendering':'dart2wasm/skwasm single-threaded','serviceWorker':False})
    notices=app/'notices';notices.mkdir()
    for license_file in (web.parent.parent/'assets/fonts').glob('*LICENSE*'):
        shutil.copyfile(license_file,notices/license_file.name)
    (app/'source.json').write_text(json.dumps(source,indent=2)+'\n')
    files=[p for p in app.rglob('*') if p.is_file()];size=sum(p.stat().st_size for p in files)
    if size>100*1024*1024: raise ValueError(f'Browser app exceeds 100 MiB: {size}')
    if any(p.suffix.lower() in ['.onnx','.apk','.aab'] for p in files): raise ValueError('A model or Android distribution leaked into the web bundle.')
    print(json.dumps({'bundle':build,'bytes':size,'files':len(files),'source':SOURCE},indent=2))
    return source

def build(source,flutter,scratch):
    if scratch.exists(): raise ValueError('Use a new task-owned scratch directory.')
    revision=subprocess.check_output(['git','-C',str(flutter),'rev-parse','HEAD'],text=True).strip()
    if revision!=SDK: raise ValueError(f'Wrong Flutter revision: {revision}')
    subprocess.run([sys.executable,str(source/'tool/build_workspace.py'),'preflight'],check=True)
    if shutil.disk_usage(ROOT).free<12*GIB: raise ValueError('Need expected 2 GiB growth plus 10 GiB reserve.')
    scratch.mkdir(parents=True);(scratch/'owner.json').write_text(json.dumps({'owner':'Mobile Maia browser build','source':SOURCE,'retention':'through deployment verification','expectedGrowthGiB':2,'reserveGiB':10},indent=2)+'\n')
    env=os.environ.copy();env['XDG_CONFIG_HOME']=str(scratch/'config');env['FLUTTER_SUPPRESS_ANALYTICS']='true'
    cmd=[str(flutter/'bin/flutter')]
    # A fresh official SDK checkout has no material fonts until tool bootstrap.
    subprocess.run(cmd+['precache','--web'],env=env,check=True)
    app=scratch/'app';prepare(source,app,flutter)
    subprocess.run(cmd+['pub','get','--enforce-lockfile'],cwd=app,env=env,check=True)
    subprocess.run([sys.executable,str(source/'tool/build_workspace.py'),'preflight'],check=True)
    subprocess.run(cmd+['build','web','--wasm','--release','--no-pub','--target','lib/browser_entry.dart','--base-href','/play/app/','--no-web-resources-cdn','--source-maps','--pwa-strategy','none','--no-tree-shake-icons'],cwd=app,env=env,check=True)
    return assemble(app/'build/web',scratch/'deploy')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path);p.add_argument('--flutter',type=pathlib.Path);p.add_argument('--scratch',type=pathlib.Path);p.add_argument('--assemble-existing',type=pathlib.Path);p.add_argument('--deploy',type=pathlib.Path);a=p.parse_args()
    if a.assemble_existing: assemble(a.assemble_existing.resolve(),a.deploy.resolve())
    else: build(a.source.resolve(),a.flutter.resolve(),a.scratch.resolve())

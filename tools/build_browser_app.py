#!/usr/bin/env python3
"""Build canonical Mobile Maia widgets and assemble an immutable Pages bundle."""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess, sys
from prepare_browser_app import ROOT, SOURCE, prepare
from prepare_browser_chess import prepare_chess
GIB=1024**3
SDK='737ba8f885dc774b53b442759999a312c9461e4e'
def digest_tree(path):
    digest=hashlib.sha256()
    for file in sorted(p for p in path.rglob('*') if p.is_file() and p.name != '.last_build_id'):
        digest.update(file.relative_to(path).as_posix().encode());digest.update(file.read_bytes())
    return digest.hexdigest()[:16]

def prepare_offline_shell(deploy, app, bundle):
    """Precache both compiler targets and their renderers, excluding source maps."""
    paths = set(p for p in (deploy/'play').rglob('*') if p.is_file() and not p.is_relative_to(app))
    paths.update([deploy/'styles.css', deploy/'assets/icon.png'])
    lab = deploy/'lab/inference'
    paths.update(lab/name for name in ['config.json','core.mjs','vendor/ort.wasm.min.mjs',
        'vendor/ort-wasm-simd-threaded.mjs','vendor/LICENSE','vendor/ThirdPartyNotices.txt'])
    paths.update(p for p in (app/'notices').rglob('*') if p.is_file())
    paths.update([app/'index.html', app/'source.json'])
    paths.update(app.glob('flutter_bootstrap.*.js'))
    paths.update(p for p in (bundle/'assets').rglob('*') if p.is_file())
    paths.update(bundle/name for name in ['main.dart.wasm','main.dart.mjs','main.dart.js',
        'canvaskit/canvaskit.js','canvaskit/canvaskit.wasm',
        'canvaskit/skwasm.js','canvaskit/skwasm.wasm',
        'canvaskit/skwasm_heavy.js','canvaskit/skwasm_heavy.wasm'])
    assets = [{'url':'/'+path.relative_to(deploy).as_posix(), 'bytes':path.stat().st_size,
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in sorted(paths)]
    template=(ROOT/'browser-app/pwa/sw.js').read_text()
    encoded=json.dumps(assets,separators=(',',':'))
    release=hashlib.sha256((encoded+template).encode()).hexdigest()[:20]
    (deploy/'play/sw.js').write_text(template.replace('__PWA_RELEASE__',json.dumps(release)).replace('__PWA_ASSETS__',encoded))
    size=sum(asset['bytes'] for asset in assets)
    if size>40*1024*1024: raise ValueError(f'Offline shell exceeds 40 MiB budget: {size}')
    print(json.dumps({'offlineRelease':release,'shellBytes':size,'shellFiles':len(assets)}))
    return release
def assemble(web,deploy):
    if deploy.exists(): raise ValueError('Deployment output must be new.')
    shutil.copytree(ROOT/'site',deploy)
    pwa_version=hashlib.sha256((deploy/'play/pwa.mjs').read_bytes()).hexdigest()[:16]
    for relative in ['play/host.mjs','play/native/platform.mjs']:
        script=deploy/relative
        script.write_text(script.read_text().replace('__PWA_SOURCE__',pwa_version))
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
    bootstrap=bootstrap[:marker]+f"const useJavaScript = new URLSearchParams(location.search).get('renderer') === 'js';\n_flutter.loader.load({{config:{{...(useJavaScript ? {{renderer:'canvaskit'}} : {{}}),assetBase:'bundle-{build}/',canvasKitBaseUrl:'bundle-{build}/canvaskit/',canvasKitVariant:'full',forceSingleThreadedSkwasm:true}}}});\n"
    name=f'flutter_bootstrap.{build}.js';(app/name).write_text(bootstrap)
    runtime=hashlib.sha256(b''.join((deploy/'play/native'/f).read_bytes() for f in ['platform.mjs','maia-worker.mjs'])).hexdigest()[:16]
    index=index.replace('</head>',f'<meta name="mobile-maia-bootstrap" content="{name}"><meta name="mobile-maia-asset-base" content="bundle-{build}/"></head>')
    index=index.replace('../native/platform.mjs','../native/platform.mjs?v='+runtime)
    (app/'index.html').write_text(index)
    host=deploy/'play/index.html'
    host_text=host.read_text().replace('__BROWSER_BUILD__',build)
    for name in ['host.mjs','host.css']:
        version=hashlib.sha256((deploy/'play'/name).read_bytes()).hexdigest()[:16]
        host_text=re.sub(re.escape(name)+r'\?v=[^"\s]+',name+'?v='+version,host_text)
    host.write_text(host_text)
    source=json.loads((web.parent.parent/'browser-source.json').read_text())
    source['chessVerification']=json.loads((web.parent.parent.parent/'chess-verification.json').read_text())
    website_revision=subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'],text=True).strip()
    source.update({'websiteRevision':website_revision,
        'websiteDirty':bool(subprocess.check_output(['git','-C',str(ROOT),'status','--porcelain'],text=True).strip()),
        'adaptationRegister':f'https://github.com/Dash1971/mobilemaia.org/blob/{website_revision}/docs/WEB_ADAPTATIONS.md'})
    source.update({'bundle':build,'runtime':runtime,'flutterRevision':SDK,'modelDefault':'5m','rendering':'dart2wasm/skwasm or dart2js/CanvasKit; single-threaded','serviceWorker':True,'serviceWorkerScope':'/play/'})
    notices=app/'notices';notices.mkdir()
    for license_file in (web.parent.parent/'assets/fonts').glob('*LICENSE*'):
        shutil.copyfile(license_file,notices/license_file.name)
    (app/'source.json').write_text(json.dumps(source,indent=2)+'\n')
    files=[p for p in app.rglob('*') if p.is_file()];size=sum(p.stat().st_size for p in files)
    if size>100*1024*1024: raise ValueError(f'Browser app exceeds 100 MiB: {size}')
    if any(p.suffix.lower() in ['.onnx','.apk','.aab'] for p in files): raise ValueError('A model or Android distribution leaked into the web bundle.')
    prepare_offline_shell(deploy,app,bundle)
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
    original_chess, browser_chess = prepare_chess(app)
    subprocess.run([sys.executable,str(ROOT/'tools/test_browser_chess.py'),'--app',str(app),'--original',str(original_chess),'--flutter',str(flutter)],env=env,check=True)
    subprocess.run([sys.executable,str(source/'tool/build_workspace.py'),'preflight'],check=True)
    subprocess.run(cmd+['build','web','--wasm','--release','--no-pub','--target','lib/browser_entry.dart','--base-href','/play/app/','--no-web-resources-cdn','--source-maps','--pwa-strategy','none','--no-tree-shake-icons'],cwd=app,env=env,check=True)
    return assemble(app/'build/web',scratch/'deploy')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path);p.add_argument('--flutter',type=pathlib.Path);p.add_argument('--scratch',type=pathlib.Path);p.add_argument('--assemble-existing',type=pathlib.Path);p.add_argument('--deploy',type=pathlib.Path);a=p.parse_args()
    if a.assemble_existing: assemble(a.assemble_existing.resolve(),a.deploy.resolve())
    else: build(a.source.resolve(),a.flutter.resolve(),a.scratch.resolve())

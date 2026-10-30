"""Offline builds; the games are never opened. Python 3.9 is a build tool only."""
import argparse, hashlib, json, pathlib, shutil, subprocess, tempfile, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
CAPTURE = ROOT / '.artifacts/integration-wave-20261029'
STAMP = (2026, 10, 29, 0, 0, 0)

def digest(data): return hashlib.sha256(data).hexdigest()
def zip_bytes(files):
    import io
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name.replace('\\', '/'), STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, data)
    return out.getvalue()
def publish_record(game_id, files, module, port, installer, version="1.0.0", validation="pending"):
    module_hash = digest(files[module])
    files['shenpulse-module.json'] = (json.dumps(dict(gameId=game_id, version=version, host='127.0.0.1', port=port, inGameValidation=validation, files=[dict(file=module,sha256=module_hash)]),indent=2)+'\n').encode()
    data = zip_bytes(files)
    filename = game_id+'-shenpulse-'+version+'.zip'
    build = ROOT / '.artifacts/game-pack-builds' / game_id / version
    build.mkdir(parents=True,exist_ok=True)
    asset = dict(gameId=game_id,id='module',version=version,key='installer-assets/'+game_id+'/'+version+'/'+filename,fileName=filename,action='extract',size=len(data),sha256=digest(data),buildPath=(build/filename).relative_to(ROOT).as_posix())
    registry_file=ROOT/'scripts/manifests/game-packs.json'
    registry=json.loads(registry_file.read_text(encoding='utf8'))
    existing=next((x for x in registry['assets'] if x['key']==asset['key']),None)
    if existing and existing['sha256']!=asset['sha256']: raise ValueError('Published immutable pack changed: '+game_id)
    (build/filename).write_bytes(data)
    (build/'asset.json').write_text(json.dumps(asset,indent=2)+'\n',encoding='utf8')
    if not existing: registry['assets'].append({k:v for k,v in asset.items() if k not in ['fileName','action']})
    registry_file.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    definitions_file=ROOT/'resources/catalogs/owner-prepared-modules.json'
    definitions=json.loads(definitions_file.read_text(encoding='utf8'))
    definitions[game_id]=dict(version=version,port=port,durationMultiplier=1000,asset={k:asset[k] for k in ['id','action','fileName','size','sha256']},module=module,moduleSha256=module_hash,inGameValidation=validation,installer=installer)
    definitions[game_id]['asset']['url']='https://f003.backblazeb2.com/file/shenpulse-media/'+asset['key']
    definitions_file.write_text(json.dumps(definitions,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(game_id+': '+str(len(data))+' bytes, '+asset['sha256'])

def mari0():
    original=CAPTURE/'mari0/mari0_cc.exe'
    expected=json.loads((ROOT/'scripts/integration-preparation/script-inputs.json').read_text())['mari0']
    if digest(original.read_bytes())!=expected: raise ValueError('Mari0 release changed')
    with zipfile.ZipFile(original) as z:
        prefix=original.read_bytes()[:min(x.header_offset for x in z.infolist())]
        game_files={x.filename:z.read(x) for x in z.infolist() if not x.is_dir()}
    for name,data in list(game_files.items()):
        if name.endswith('.lua'):
            text=data.decode('utf8')
            if name=='crowdcontrol_thread.lua':
                anchor='local address, port = "localhost", 28379'
                if text.count(anchor)!=1: raise ValueError('Mari0 TCP anchor changed')
                text=text.replace(anchor,'local address, port = "127.0.0.1", 58813')
            game_files[name]=text.replace('Crowd Control','ShenPulse').encode('utf8')
    executable=prefix+zip_bytes(game_files)
    files={x.name:x.read_bytes() for x in (CAPTURE/'mari0').iterdir() if x.is_file() and x.suffix.lower()!='.exe'}
    files['ShenPulseMari0.exe']=executable
    publish_record('mari0',files,'ShenPulseMari0.exe',58813,dict(managedTarget=True,executables=['ShenPulseMari0.exe'],launchExecutables=['ShenPulseMari0.exe'],singleInstanceProcesses=['ShenPulseMari0'],requireLaunchExecutable=True,requiresMinecraftEula=False))

def sims(python39):
    source=CAPTURE/'upstream/Sims4/CrowdControl-Sims4-1.0.5.zip.extracted/CrowdControl-Sims4/CrowdControl.ts4script'
    expected=json.loads((ROOT/'scripts/integration-preparation/script-inputs.json').read_text())['sims4']
    if digest(source.read_bytes())!=expected: raise ValueError('Sims script changed')
    scripts={}
    with zipfile.ZipFile(source) as z:
        for name in z.namelist():
            if name.endswith('.py'):
                s=z.read(name).decode('utf8')
                if name=='main.py':
                    if s.count('PORT = 58430')!=1: raise ValueError('Sims TCP anchor changed')
                    s=s.replace('PORT = 58430','PORT = 58814').replace('Crowd Control','ShenPulse').replace("'cc_connect'","'shenpulse_connect'").replace("'cc_messages'","'shenpulse_messages'")
                scripts[name]=s.encode('utf8')
        original_magic=z.read('main.pyc')[:4]
    with tempfile.TemporaryDirectory(prefix='shenpulse-sims-build-') as temporary:
        stage=pathlib.Path(temporary)
        for name,data in list(scripts.items()):
            py=stage/name
            py.parent.mkdir(parents=True,exist_ok=True)
            py.write_bytes(data)
            pyc=py.with_suffix('.pyc')
            subprocess.run([python39,'-c','import py_compile,sys;py_compile.compile(sys.argv[1],cfile=sys.argv[2],dfile=sys.argv[3],doraise=True,invalidation_mode=py_compile.PycInvalidationMode.CHECKED_HASH)',str(py),str(pyc),name],check=True)
            if pyc.read_bytes()[:4]!=original_magic: raise ValueError('Sims Python bytecode version mismatch')
            scripts[str(pathlib.PurePosixPath(name).with_suffix('.pyc'))]=pyc.read_bytes()
    mod=zip_bytes(scripts)
    module='.shenpulse-sims4-mods/ShenPulse.ts4script'
    publish_record('the-sims-4',{module:mod},module,58814,dict(directoryNames=['The Sims 4','Les Sims 4'],steamAppIds=['1222670'],executables=['Game/Bin/TS4_x64.exe'],launchExecutables=['Game/Bin/TS4_x64.exe'],singleInstanceProcesses=['TS4_x64'],requireLaunchExecutable=True,forceSteamLaunch=True,additionalInstallTargets=[dict(root='documents',sourcePath='.shenpulse-sims4-mods',targetPath='Electronic Arts/The Sims 4/Mods/ShenPulse',directory=True)]))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--python39',required=True)
    args=parser.parse_args()
    mari0();sims(args.python39)

import hashlib,importlib.util,json,pathlib,shutil,sys,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
CAPTURE=ROOT/'.artifacts/integration-wave-20261029';out=pathlib.Path(sys.argv[1])
runtime=CAPTURE/'dotnet-runtime-6.0.36-win-x64.zip';metadata=json.loads((CAPTURE/'dotnet6-runtime.json').read_text())
if hashlib.sha512(runtime.read_bytes()).hexdigest()!=metadata['hash'].lower():raise ValueError('Runtime signature mismatch')
filename='dotnet-runtime-6.0.36-win-x64.zip';key='installer-assets/common/dotnet/6.0.36/'+filename;sha=common.digest(runtime.read_bytes());build=ROOT/'.artifacts/game-pack-builds/unity-dotnet-runtime/6.0.36';build.mkdir(parents=True,exist_ok=True);shutil.copyfile(runtime,build/filename)
registryFile=ROOT/'scripts/manifests/game-packs.json';registry=json.loads(registryFile.read_text())
asset=dict(gameId='unity-dotnet-runtime',id='dotnet6-runtime',version='6.0.36',key=key,size=runtime.stat().st_size,sha256=sha,buildPath=(build/filename).relative_to(ROOT).as_posix())
existing=next((a for a in registry['assets'] if a['key']==key),None)
if existing and existing['sha256']!=sha:raise ValueError('Immutable runtime changed')
if not existing:registry['assets'].append(asset)
registryFile.write_text(json.dumps(registry,indent=2)+'\n',encoding='utf8');(build/'asset.json').write_text(json.dumps(asset,indent=2)+'\n',encoding='utf8')
with zipfile.ZipFile(CAPTURE/'MelonLoader-0.7.3-x64.zip') as z:files={n:z.read(n) for n in z.namelist() if not n.endswith('/')}
files['Mods/ShenPulse.Fusion.Bridge.dll']=(out/'ShenPulse.Fusion.Bridge.dll').read_bytes()
files['Mods/ShenPulse.Fusion.Engine.dll']=(out/'ShenPulse.Fusion.Engine.dll').read_bytes()
files['UserLibs/SixLabors.ImageSharp.dll']=(CAPTURE/'s2e-modules/PvZFusion/module.zip.extracted/Mods/SixLabors.ImageSharp.dll').read_bytes()
common.publish_record('pvz-fusion',files,'Mods/ShenPulse.Fusion.Bridge.dll',58827,dict(directoryNames=['PlantsVsZombiesRH','PVZ Fusion','Plants vs Zombies Fusion'],executables=['PlantsVsZombiesRH.exe'],launchExecutables=['PlantsVsZombiesRH.exe'],singleInstanceProcesses=['PlantsVsZombiesRH'],requireLaunchExecutable=True))
definitionsFile=ROOT/'resources/catalogs/owner-prepared-modules.json';definitions=json.loads(definitionsFile.read_text())
definitions['pvz-fusion']['additionalAssets']=[dict(id='dotnet6-runtime',action='extract',targetPath='dotnet',fileName=filename,size=runtime.stat().st_size,sha256=sha,url='https://f003.backblazeb2.com/file/shenpulse-media/'+key)]
definitions['pvz-fusion']['moduleDependencies']={n:common.digest(files[n]) for n in ['Mods/ShenPulse.Fusion.Engine.dll','UserLibs/SixLabors.ImageSharp.dll','version.dll']}
definitionsFile.write_text(json.dumps(definitions,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

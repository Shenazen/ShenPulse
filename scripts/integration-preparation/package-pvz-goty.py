import hashlib,importlib.util,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2];info=json.loads((ROOT/'.artifacts/integration-wave-20261029/pvz-goty-build.json').read_text());out=pathlib.Path(info['out']);runtime=pathlib.Path('C:/Program Files/dotnet/shared/Microsoft.NETCore.App/8.0.31')
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
files={'ShenPulsePvz/'+f.name:f.read_bytes() for f in runtime.iterdir() if f.is_file() and f.suffix.lower() in ['.dll','.json','.txt']};files['ShenPulsePvz/hostfxr.dll']=pathlib.Path('C:/Program Files/dotnet/host/fxr/8.0.31/hostfxr.dll').read_bytes()
for n in info['files']+['ShenPulse.Pvz.Host.dll']:files['ShenPulsePvz/'+n]=(out/n).read_bytes()
with zipfile.ZipFile(ROOT/'.artifacts/game-pack-builds/emulator-common/1.0.0/apphost.nupkg') as z:apphost=bytearray(z.read('runtimes/win-x64/native/apphost.exe'))
needle=b'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2';offset=apphost.find(needle)
if offset<0 or apphost.count(needle)!=1:raise ValueError('Microsoft apphost changed')
apphost[offset:offset+len(needle)]=b'\0'*len(needle);name=b'ShenPulse.Pvz.Host.dll';apphost[offset:offset+len(name)]=name;files['ShenPulsePvz/ShenPulse.Pvz.Host.exe']=bytes(apphost)
files['ShenPulsePvz/ShenPulse.Pvz.Host.runtimeconfig.json']=json.dumps(dict(runtimeOptions=dict(tfm='net8.0',includedFrameworks=[dict(name='Microsoft.NETCore.App',version='8.0.31')]))).encode()
managed={};native={}
for name,data in files.items():
 if not name.endswith('.dll'):continue
 pe=int.from_bytes(data[60:64],'little')+24;start=pe+(112 if int.from_bytes(data[pe:pe+2],'little')==0x20b else 96);is_managed=int.from_bytes(data[start+14*8:start+14*8+4],'little')!=0
 (managed if is_managed else native)[pathlib.PurePosixPath(name).name]={}
key='.NETCoreApp,Version=v8.0/win-x64';deps=dict(runtimeTarget=dict(name=key,signature=''),targets={key:{'ShenPulse.Pvz.Host/1.0.0':dict(runtime=managed,native=native)}},libraries={'ShenPulse.Pvz.Host/1.0.0':dict(type='project',serviceable=False,sha512='')})
files['ShenPulsePvz/ShenPulse.Pvz.Host.deps.json']=json.dumps(deps).encode();module='ShenPulsePvz/ShenPulse.Pvz.Host.dll'
common.publish_record('plants-vs-zombies-goty',files,module,58836,dict(helperGame='pvz-goty',steamAppIds=['3590'],directoryNames=['Plants Vs Zombies','Plants vs Zombies','Plants vs. Zombies GOTY'],executables=['PlantsVsZombies.exe','popcapgame1.exe'],launchExecutables=['PlantsVsZombies.exe'],singleInstanceProcesses=['PlantsVsZombies','popcapgame1'],unsupportedPlatforms=['xbox'],requireLaunchExecutable=True),version='1.0.0')
p=ROOT/'resources/catalogs/owner-prepared-modules.json';r=json.loads(p.read_text());r['plants-vs-zombies-goty']['moduleDependencies']={n:hashlib.sha256(files[n]).hexdigest() for n in files if n.endswith(('.dll','.exe'))};p.write_text(json.dumps(r,indent=2)+'\n')

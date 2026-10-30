import hashlib,importlib.util,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2];info=json.loads((ROOT/'.artifacts/integration-wave-20261029/tf2-host-build.json').read_text());out=pathlib.Path(info['out']);runtime=pathlib.Path('C:/Program Files/dotnet/shared/Microsoft.NETCore.App/8.0.31')
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
files={'ShenPulseTf2/'+f.name:f.read_bytes() for f in runtime.iterdir() if f.is_file() and f.suffix.lower() in ['.dll','.json','.txt']};files['ShenPulseTf2/hostfxr.dll']=pathlib.Path('C:/Program Files/dotnet/host/fxr/8.0.31/hostfxr.dll').read_bytes()
for n in info['files']+['ShenPulse.Tf2.Host.dll']:files['ShenPulseTf2/'+n]=(out/n).read_bytes()
with zipfile.ZipFile(ROOT/'.artifacts/game-pack-builds/emulator-common/1.0.0/apphost.nupkg') as z:apphost=bytearray(z.read('runtimes/win-x64/native/apphost.exe'))
needle=b'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2';offset=apphost.find(needle)
if offset<0 or apphost.count(needle)!=1:raise ValueError('Microsoft apphost changed')
apphost[offset:offset+len(needle)]=b'\0'*len(needle);name=b'ShenPulse.Tf2.Host.dll';apphost[offset:offset+len(name)]=name;files['ShenPulseTf2/ShenPulse.Tf2.Host.exe']=bytes(apphost)
files['ShenPulseTf2/ShenPulse.Tf2.Host.runtimeconfig.json']=json.dumps(dict(runtimeOptions=dict(tfm='net8.0',includedFrameworks=[dict(name='Microsoft.NETCore.App',version='8.0.31')]))).encode()
managed={};native={}
for name,data in files.items():
 if not name.endswith('.dll'):continue
 pe=int.from_bytes(data[60:64],'little')+24;start=pe+(112 if int.from_bytes(data[pe:pe+2],'little')==0x20b else 96);is_managed=int.from_bytes(data[start+14*8:start+14*8+4],'little')!=0
 (managed if is_managed else native)[pathlib.PurePosixPath(name).name]={}
key='.NETCoreApp,Version=v8.0/win-x64';deps=dict(runtimeTarget=dict(name=key,signature=''),targets={key:{'ShenPulse.Tf2.Host/1.0.0':dict(runtime=managed,native=native)}},libraries={'ShenPulse.Tf2.Host/1.0.0':dict(type='project',serviceable=False,sha512='')})
files['ShenPulseTf2/ShenPulse.Tf2.Host.deps.json']=json.dumps(deps).encode();module='ShenPulseTf2/ShenPulse.Tf2.Host.dll'
common.publish_record('team-fortress-2',files,module,58832,dict(helperGame='tf2',directLauncher=True,forceSteamLaunch=False,steamAppIds=['440'],directoryNames=['Team Fortress 2'],executables=['tf_win64.exe','tf.exe','hl2.exe'],launchExecutables=['tf_win64.exe','tf.exe','hl2.exe'],launchArguments=['-game','tf','-steam','-secure','-usercon','-condebug','-conclearlog'],singleInstanceProcesses=['tf_win64','tf','hl2'],requireLaunchExecutable=True),version='1.0.1')
p=ROOT/'resources/catalogs/owner-prepared-modules.json';r=json.loads(p.read_text());r['team-fortress-2']['moduleDependencies']={n:hashlib.sha256(files[n]).hexdigest() for n in files if n.endswith(('.dll','.exe'))};p.write_text(json.dumps(r,indent=2)+'\n')

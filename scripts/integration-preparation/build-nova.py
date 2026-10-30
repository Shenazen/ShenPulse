import hashlib,importlib.util,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2];C=ROOT/'.artifacts/integration-wave-20261029/nova';pins=json.loads((C/'source.json').read_text())
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
rom=(C/'nova.nes').read_bytes();emulator=(C/'Bizhawk-2.9.1.zip').read_bytes()
if hashlib.md5(rom).hexdigest()!='ecc08609f53c236e16731e75c857c934' or hashlib.sha256(emulator).hexdigest()!=pins['bizhawk']['sha256']:raise ValueError('Nova or emulator input changed')
files={}
with zipfile.ZipFile(C/'Bizhawk-2.9.1.zip') as z:
 for n in z.namelist():
  if n.endswith('/') or '/CrowdControl/' in n:continue
  relative=n.removeprefix('Bizhawk-2.9.1/');files['BizHawk/'+relative]=z.read(n)
module='ShenPulseNova/bridge.lua';files[module]=(ROOT/'scripts/integration-preparation/nova-bridge.lua').read_bytes();files['ROM/nova.nes']=rom
files['ShenPulseNova/credits.txt']=b'Nova the Squirrel v1.0.6a - NovaSquirrel. Original game and artwork remain credited to their authors. Source: https://github.com/NovaSquirrel/NovaTheSquirrel\nShenPulse local integration.\n'
common.publish_record('nova-the-squirrel',files,module,58831,dict(fileGame='bizhawk',managedTarget=True,executables=['BizHawk/EmuHawk.exe'],launchExecutables=['BizHawk/EmuHawk.exe'],launchArguments=['--lua={{installation}}/ShenPulseNova/bridge.lua','{{installation}}/ROM/nova.nes'],singleInstanceProcesses=['EmuHawk'],requireLaunchExecutable=True))
p=ROOT/'resources/catalogs/owner-prepared-modules.json';r=json.loads(p.read_text());r['nova-the-squirrel']['moduleDependencies']={'ROM/nova.nes':hashlib.sha256(rom).hexdigest(),'BizHawk/EmuHawk.exe':hashlib.sha256(files['BizHawk/EmuHawk.exe']).hexdigest()};p.write_text(json.dumps(r,indent=2)+'\n')

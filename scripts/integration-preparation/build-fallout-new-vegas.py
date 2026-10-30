import hashlib,importlib.util,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,ROOT/file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
common=load('common','scripts/integration-preparation/build-script-games.py')
native=load('native','scripts/integration-preparation/build-ue4-games.py')
root=ROOT/'.artifacts/integration-wave-20261029'
definitions=json.loads((ROOT/'resources/catalogs/owner-prepared-modules.json').read_text(encoding='utf8'))
if definitions.get('fallout-new-vegas',{}).get('platformModules',{}).get('xbox'):
 print('Fallout New Vegas : définition Steam / Xbox conservée. Utilisez build-fnv-xbox.js pour le module Xbox versionné.')
 raise SystemExit(0)
pins=json.loads((ROOT/'scripts/integration-preparation/fallout-new-vegas-inputs.json').read_text())
def locked(p):
 data=p.read_bytes()
 if pins.get(p.relative_to(ROOT).as_posix())!=hashlib.sha256(data).hexdigest():raise ValueError('FNV input changed')
 return data
source=root/'upstream/FalloutNewVegas/FalloutNewVegas-CC-1.0.1.zip.extracted/Data/NVSE/Plugins/CrowdControl.dll'
data=locked(source)
if data.count(b'5421\0')!=1:raise ValueError('FNV port literal changed')
data=native.strings(data.replace(b'5421\0',b'5422\0'))
module='Data/NVSE/Plugins/ShenPulse.dll';files={module:data}
for name in ['nvse_1_4.dll','nvse_loader.exe','nvse_steam_loader.dll','Data/NVSE/nvse_config.ini']:files[name]=locked(root/'xnvse'/name)
common.publish_record('fallout-new-vegas',files,module,5422,dict(parameterFormat='array',steamAppIds=['22380'],directoryNames=['Fallout New Vegas','FalloutNV'],executables=['FalloutNV.exe'],launchExecutables=['nvse_loader.exe'],singleInstanceProcesses=['FalloutNV'],directLauncher=True,forceSteamLaunch=False,unsupportedPlatforms=['xbox']))

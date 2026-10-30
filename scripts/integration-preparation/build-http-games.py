"""Build pinned local HTTP adapters. No game is opened or loaded."""
import hashlib,importlib.util,json,pathlib,subprocess,tempfile,shutil
ROOT=pathlib.Path(__file__).resolve().parents[2];CAPTURE=ROOT/'.artifacts/integration-wave-20261029'
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
pins=json.loads((ROOT/'scripts/integration-preparation/http-engine-inputs.json').read_text())
def run(*args):subprocess.run([str(x) for x in args],check=True,stdout=subprocess.DEVNULL)
def rename(s):return s.replace('Stream To Earn','ShenPulse').replace('StreamToEarn','ShenPulse').replace('streamtoearn.io','shenpulse.leuridan.fr').replace('S2E','ShenPulse').replace('s2e','shenpulse')
with tempfile.TemporaryDirectory(prefix='shenpulse-http-build-') as tmp:
 stage=pathlib.Path(tmp);csc=ROOT/'.artifacts/cc-audit/super-mario-kart/client/roslyn/csc.exe';cecil=ROOT/'.tmp-cecil/package/lib/net40/Mono.Cecil.dll';shutil.copyfile(cecil,stage/'Mono.Cecil.dll')
 for tool in ['DecodeConstants','RunConstantProbe','PatchHttpEngine']:run(csc,'/nologo','/target:exe','/out:'+str(stage/(tool+'.exe')),'/reference:'+str(cecil),ROOT/('scripts/integration-preparation/'+tool+'.cs'))
 for source_id,game_id,old_dll,assembly,port,app,exe in [('tabs','totally-accurate-battle-simulator','tabs.dll','ShenPulse.Tabs',58828,'508440','TotallyAccurateBattleSimulator.exe'),('roadsideResearch','roadside-research','s2e-roadside-research.dll','ShenPulse.Roadside',58829,'3643170','Roadside Research.exe')]:
  source=CAPTURE/'s2e-modules'/source_id/'module.zip.extracted';original=source/'BepInEx/plugins'/old_dll
  for file in source.rglob('*'):
   if file.is_file() and hashlib.sha256(file.read_bytes()).hexdigest()!=pins.get(file.relative_to(ROOT).as_posix()):raise ValueError('HTTP engine input changed: '+file.name)
  probe=stage/(source_id+'-probe.dll');keys=stage/(source_id+'-keys.txt');values=stage/(source_id+'-values.txt');output=stage/(assembly+'.dll')
  run(stage/'DecodeConstants.exe',original,probe,keys);run(stage/'RunConstantProbe.exe',probe,values);run(stage/'PatchHttpEngine.exe',original,output,keys,values,port,assembly)
  files={}
  for file in sorted(source.rglob('*')):
   if not file.is_file() or file==original or file.name=='s2e_info.json':continue
   relative=file.relative_to(source).as_posix();data=file.read_bytes()
   if file.suffix.lower() in ['.txt','.ini','.cfg','.json','.md']:data=rename(data.decode('utf-8-sig')).encode('utf8')
   files[rename(relative)]=data
  module='BepInEx/plugins/'+assembly+'.dll';files[module]=output.read_bytes()
  common.publish_record(game_id,files,module,port,dict(localHttpGame=True,steamAppIds=[app],directoryNames=['Totally Accurate Battle Simulator','TotallyAccurateBattleSimulator'] if source_id=='tabs' else ['Roadside Research'],executables=[exe],launchExecutables=[exe],singleInstanceProcesses=[pathlib.Path(exe).stem],requireLaunchExecutable=True,forceSteamLaunch=True))

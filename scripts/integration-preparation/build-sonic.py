import hashlib,importlib.util,json,pathlib,re,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
source=ROOT/'.artifacts/integration-wave-20261029/upstream/SonicRoboBlast2/SL_CrowdControl-101.zip.extracted/SL_CrowdControl.pk3'
pins=json.loads((ROOT/'scripts/integration-preparation/script-inputs.json').read_text())
if hashlib.sha256(source.read_bytes()).hexdigest()!=pins['sonic']:raise ValueError('Sonic input changed')
with zipfile.ZipFile(source) as z: files={n:z.read(n) for n in z.namelist() if not n.endswith('/')}
for name,data in list(files.items()):
 if not name.endswith('.lua'):continue
 s=data.decode('utf8').replace('Crowd Control','ShenPulse').replace('CrowdControl','ShenPulse').replace('client/crowd_control/','client/shenpulse/')
 if name=='Lua/connection.lua':
  s=s.replace('connector.txt','ready.txt').replace('input.txt','request.json').replace('output.txt','response.json')
  start=s.index('\t\tif keepalive_timer >= TICRATE then');end=s.index('\n\t\tif io.type(output_file)',start)
  s=s[:start]+'''\t\tif keepalive_timer >= TICRATE then
            local heartbeat = open_local(state_path,"w")
            if heartbeat then write_file(heartbeat,"READY");heartbeat:close() end
            keepalive_timer=0
        end'''+s[end:]
 files[name]=s.encode('utf8')
module='addons/ShenPulse.pk3'
common.publish_record('sonic-robo-blast-2',{module:common.zip_bytes(files)},module,58820,dict(fileGame='srb2',directoryNames=['Sonic Robo Blast 2','SRB2'],executables=['srb2win.exe','srb2win64.exe','srb2.exe'],launchExecutables=['srb2win.exe','srb2win64.exe','srb2.exe'],singleInstanceProcesses=['srb2win','srb2win64','srb2'],forceSteamLaunch=False,launchArguments=['-home','{{installation}}/.shenpulse-home','-file','addons/ShenPulse.pk3']))

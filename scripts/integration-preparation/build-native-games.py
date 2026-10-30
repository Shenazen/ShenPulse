"""Prepare pinned native Windows modules. No process injection or game execution occurs here."""
import hashlib,importlib.util,json,pathlib,re,struct
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
CAPTURE=ROOT/'.artifacts/integration-wave-20261029/upstream'
PINS=json.loads((ROOT/'scripts/integration-preparation/native-inputs.json').read_text())
def locked(file):
 data=file.read_bytes();relative=file.relative_to(ROOT).as_posix()
 if PINS.get(relative)!=hashlib.sha256(data).hexdigest():raise ValueError('Native source changed: '+relative)
 return data
def branding(data):
 for old,new in [('Crowd Control','ShenPulse'),('CROWD CONTROL','SHENPULSE'),('CrowdControl','ShenPulse')]:
  for encoding in ['ascii','utf-16le']:
   a,b=old.encode(encoding),new.ljust(len(old)).encode(encoding)
   data=data.replace(a,b)
 return data
def peggle(folder,game_id,port,app,exe):
 root=CAPTURE/folder/('CrowdControl'+folder+'-111.zip.extracted')
 if folder=='Peggle':root=CAPTURE/folder/'CrowdControlPeggle-111.zip.extracted'
 module='Mods/peggle-cc.dll';data=locked(root/module)
 needle=b'\x68'+struct.pack('<I',43384)
 if data.count(needle)!=1 or data.index(needle)!=120524:raise ValueError('Peggle push-port instruction changed')
 data=branding(data.replace(needle,b'\x68'+struct.pack('<I',port)))
 files={module:data,'Mods/haggle-sdk.dll':locked(root/'Mods/haggle-sdk.dll'),'ddraw.dll':locked(CAPTURE/folder/'loader-v0.4.0.zip.extracted/ddraw.dll')}
 common.publish_record(game_id,files,module,port,dict(parameterFormat='array',steamAppIds=[app],directoryNames=[folder,'Peggle Deluxe' if folder=='Peggle' else 'Peggle Nights'],executables=[exe],forceSteamLaunch=True,additionalInstallTargets=[dict(root='programData',sourcePath='ddraw.dll',targetPath='PopCap Games/Peggle/ddraw.dll')]))
def doom():
 root=CAPTURE/'Doom2016/DOOM2016-CC-0.6.1.zip.extracted';data=locked(root/'dinput8.dll')
 old=b'51339\0'
 if data.count(old)!=1:raise ValueError('DOOM port literal changed')
 data=data.replace(old,b'58823\0')
 for encoding in ['ascii','utf-16le']:
  old='CrowdControl.ini\0'.encode(encoding);new=('ShenPulse.ini\0'+'\0'*3).encode(encoding)
  if len(old)!=len(new):raise ValueError('INI string size mismatch')
  data=data.replace(old,new)
 data=branding(data)
 ini=locked(root/'CrowdControl.ini').decode('utf8').replace('Crowd Control','ShenPulse').replace('CrowdControl','ShenPulse')
 files={'dinput8.dll':data,'ShenPulse.ini':ini.encode()}
 common.publish_record('doom-2016',files,'dinput8.dll',58823,dict(parameterFormat='array',steamAppIds=['379720'],directoryNames=['DOOM','DOOM 2016'],executables=['DOOMx64vk.exe','DOOMx64.exe'],forceSteamLaunch=True))
peggle('Peggle','peggle-deluxe',58821,'3480','Peggle.exe')
peggle('PeggleNights','peggle-nights',58822,'3540','PeggleNights.exe')
doom()

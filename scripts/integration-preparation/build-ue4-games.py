"""Repackage local UE4SS bridges with pinned inputs; never load a game here."""
import hashlib,importlib.util,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
PINS=json.loads((ROOT/'scripts/integration-preparation/ue4-inputs.json').read_text())
def rename(s):return s.replace('Crowd Control','ShenPulse').replace('CrowdControl','ShenPulse').replace('CROWD CONTROL','SHENPULSE')
def strings(data):
 # Rebuild each complete constant in place: all subsequent PE offsets stay unchanged.
 for pattern,encoding in [(rb'[\x20-\x7e]{4,}\x00','ascii'),(rb'(?:[\x20-\x7e]\x00){4,}\x00\x00','utf-16le')]:
  out=bytearray(data)
  for match in re.finditer(pattern,data):
   text=match.group().decode(encoding)
   if text.startswith('.?AV'):continue
   replacement=rename(text).encode(encoding)
   if len(replacement)>len(match.group()):raise ValueError('Native constant grew')
   out[match.start():match.end()]=replacement+b'\x00'*(len(match.group())-len(replacement))
  data=bytes(out)
 return data
def main():
 for game,folder,archive,old_port,port,prefix,app,executables in [
  ('rv-there-yet','RVThereYet','RVThereYet-CC-1.3.2',33940,58824,'Ride/Binaries/Win64/',"3949040",['Ride.exe','Ride/Binaries/Win64/Ride-Win64-Shipping.exe']),
  ('voices-of-the-void','VoicesOfTheVoid','VoicesOfTheVoid-CC-0.5.3',51338,58825,'WindowsNoEditor/VotV/Binaries/Win64/','',['WindowsNoEditor/VotV/Binaries/Win64/VotV-Win64-Shipping.exe'])]:
  source=ROOT/'.artifacts/integration-wave-20261029/upstream'/folder/(archive+'.zip.extracted');files={}
  for file in sorted(source.rglob('*')):
   if not file.is_file() or file.name in ['ccver','INSTALL.txt']:continue
   relative=file.relative_to(source).as_posix();data=file.read_bytes()
   if PINS.get(file.relative_to(ROOT).as_posix())!=hashlib.sha256(data).hexdigest():raise ValueError('UE4 input changed: '+relative)
   if relative.endswith('Mods/CrowdControl/dlls/main.dll'):
    needle=(str(old_port)+'\0').encode()
    if data.count(needle)!=1:raise ValueError('UE4 port literal changed')
    data=data.replace(needle,(str(port)+'\0').encode());data=strings(data)
   if file.suffix.lower() in ['.lua','.ini','.txt','.json']:
    text=rename(data.decode('utf-8-sig')).replace(str(old_port),str(port));data=text.encode('utf8')
   files[prefix+rename(relative)]=data
  module=prefix+'ue4ss/Mods/ShenPulse/dlls/main.dll'
  common.publish_record(game,files,module,port,dict(parameterFormat='array',steamAppIds=[app] if app else [],directoryNames=['RV There Yet','RVThereYet'] if app else ['Voices of the Void','VotV'],executables=executables,forceSteamLaunch=bool(app)))
 
if __name__=="__main__":main()

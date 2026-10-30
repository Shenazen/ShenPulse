"""Prepare the local Farming 25 module without starting or modifying the installed game."""
import argparse,hashlib,importlib.util,json,pathlib,re,zipfile
parser=argparse.ArgumentParser();parser.add_argument('--version',default='1.0.4');args=parser.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
source=ROOT/'.artifacts/integration-wave-20261029/fs25/FS25_SyncLiveBridge/SyncLiveBridge.lua'
pins=json.loads((ROOT/'scripts/integration-preparation/script-inputs.json').read_text())
if hashlib.sha256(source.read_bytes()).hexdigest()!=pins['farming25']: raise ValueError('Farming source changed')
s=source.read_text(encoding='utf8');start=s.index('-- === Fonction utilitaire:');end=s.index('function StreamUpBridge:draw()')
s=s[start:end].replace('StreamUpBridge','ShenPulseBridge').replace('StreamUp','ShenPulse').replace('SyncLive','ShenPulse').replace(':isLicensed()',':isReady()').replace(':showLicenseError()',':showNotReady()')
s=re.sub(r'streamup|synclive','ShenPulse',s,flags=re.I)
# The original manual teleport only moved the tractor, leaving joints behind.
# Use the game's own assembly-aware teleport, including its network event.
start=s.index('function ShenPulseBridge:teleportVehicleToPosition(')
end=s.index('function ShenPulseBridge:setTime(',start)
s=s[:start]+'''function ShenPulseBridge:teleportVehicleToPosition(vehicle, x, z, rotationY)
    if not vehicle or not g_currentMission.teleportVehicle then return false end
    g_currentMission:teleportVehicle(vehicle:findRootVehicle() or vehicle, x, z, rotationY or 0)
    return true
end

'''+s[end:]
start=s.index('function ShenPulseBridge:actionReset()')
end=s.index('function ShenPulseBridge:actionSuperJump()',start)
s=s[:start]+'''function ShenPulseBridge:actionReset()
    local vehicle=self:getControlledVehicle(true)
    if not vehicle then return false end
    local x,_,z=getWorldTranslation(vehicle.rootNode)
    local dx,_,dz=localDirectionToWorld(vehicle.rootNode,0,0,1)
    return self:teleportVehicleToPosition(vehicle,x,z,MathUtil.getYRotationFromDirection(dx,dz))
end

'''+s[end:]
# Propagate actual precondition failures to the command acknowledgement.
s=s.replace('    self:fillVehicle(fillTypeIndex, "Ble")','    return self:fillVehicle(fillTypeIndex, "Ble")')
s=s.replace('    self:fillVehicle(fillTypeIndex, "Orge")','    return self:fillVehicle(fillTypeIndex, "Orge")')
s=s.replace('    self:setSuperStrength(true)','    return self:setSuperStrength(true)').replace('    self:setSuperStrength(false)','    return self:setSuperStrength(false)')
s=s.replace('    self:setSuperSpeed(true)','    return self:setSuperSpeed(true)').replace('    self:setSuperSpeed(false)','    return self:setSuperSpeed(false)')
# Polling the diagnostic must not flood the log twice per second.
s=re.sub(r'^\s*print\("\[ShenPulse\] getControlledVehicle:[^\n]*\n','\n',s,flags=re.M)
header='ShenPulseBridge = {actionEventIds={},isInitialized=false,blueBales={},logoInitialized=false}\nfunction ShenPulseBridge:isReady() return g_currentMission ~= nil end\nfunction ShenPulseBridge:showNotReady() print("[ShenPulse] Chargez une sauvegarde.") end\n'
s=header+s+(ROOT/'scripts/integration-preparation/farming-bridge.lua').read_text(encoding='utf8')
if re.search(r'https?://|license|fingerprint|synclive|streamup',s,re.I): raise ValueError('External identity in Farming module')
xml='''<?xml version="1.0" encoding="utf-8"?><modDesc descVersion="99"><author>ShenPulse</author><version>VERSION.0</version><title><en>ShenPulse Interactions</en><fr>Interactions ShenPulse</fr></title><description><en>Local interactions for Farming Simulator 25.</en><fr>Interactions locales pour Farming Simulator 25. Activez ce mod dans votre sauvegarde.</fr></description><iconFilename>icon.png</iconFilename><multiplayer supported="true"/><extraSourceFiles><sourceFile filename="ShenPulseBridge.lua"/></extraSourceFiles></modDesc>'''.replace('VERSION',args.version)
module='.shenpulse-farming-mods/FS25_ShenPulse.zip'
files={module:common.zip_bytes({'modDesc.xml':xml.encode(),'ShenPulseBridge.lua':s.encode(),'icon.png':(ROOT/'build/icon.png').read_bytes()})}
common.publish_record('farming-simulator-25',files,module,58819,dict(fileGame='fs25',steamAppIds=['2300320'],directoryNames=['Farming Simulator 25','Farming Simulator 25 (PC)','FarmingSimulator2025'],xboxIdentity='GIANTSSoftware.FarmingSimulator25PC',detectPlatform=True,executables=['FarmingSimulator2025.exe','x64/FarmingSimulator2025Game.exe'],launchExecutables=['gamelaunchhelper.exe','FarmingSimulator2025.exe','x64/FarmingSimulator2025Game.exe'],singleInstanceProcesses=['FarmingSimulator2025Game','FarmingSimulator2025'],forceSteamLaunch=True),version=args.version)

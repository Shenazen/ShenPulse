"""Build the autonomous Backrooms module from pinned, authorized inputs."""
import argparse, hashlib, importlib.util, json, pathlib, re, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORK = ROOT / '.artifacts/farming-backrooms-tests'
parser = argparse.ArgumentParser()
parser.add_argument('--version', default='1.0.2')
parser.add_argument('--register', action='store_true')
parser.add_argument('--validated', action='store_true', help='Use only after the recorded Game Pass in-game suite has passed')
args = parser.parse_args()

def sha(data): return hashlib.sha256(data).hexdigest()
archive = WORK / 'backrooms-upstream.zip'
if sha(archive.read_bytes()) != '75e12b1f51da0bd112e363e0ba872b610008e1f52b9ede67fd08f0eb010d72ae':
    raise ValueError('Backrooms input archive changed')
decoder = (WORK / 'json.lua').read_bytes()
if sha(decoder) != '0eaccda57fabc0330736de25f45cf589821a42b5e0fe02e4e3125f7dc0bf2b7e':
    raise ValueError('JSON library changed')
spec = importlib.util.spec_from_file_location('common', ROOT/'scripts/integration-preparation/build-script-games.py')
common = importlib.util.module_from_spec(spec); spec.loader.exec_module(common)
prefix = 'EscapeTheBackrooms/Binaries/WinGDK/'
files = {}
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        if name.endswith('/') or name.startswith('ue4ss/Mods/SyncLive/') or name == 'LICENCE-SyncLive.txt': continue
        data = z.read(name)
        if name == 'ue4ss/Mods/mods.txt': data = b'ShenPulse : 1\nKeybinds : 0\n'
        files[prefix + name] = data
    effects = (ROOT/'scripts/integration-preparation/backrooms-effects.lua').read_text(encoding='utf8')
base = prefix + 'ue4ss/Mods/ShenPulse/'
files[base+'enabled.txt'] = b''
files[base+'Scripts/effects.lua'] = effects.encode('utf8')
files[base+'Scripts/main.lua'] = (ROOT/'scripts/integration-preparation/backrooms-bridge.lua').read_bytes()
files[prefix+'ue4ss/Mods/shared/json.lua'] = decoder
files[base+'THIRD-PARTY-NOTICES.txt'] = b'UE4SS: MIT, Copyright (c) 2022 Narknon (see ue4ss/LICENSE).\nLuaSocket: MIT, Copyright (c) 2004-2022 Diego Nehab.\nLua: MIT, Copyright (c) 1994-2024 Lua.org, PUC-Rio.\njson.lua: MIT, Copyright (c) 2020 rxi (see shared/json.lua).\n'
module = base+'Scripts/main.lua'
installer = dict(localHttpGame='backrooms',steamAppIds=['1943950'], directoryNames=['Escape the Backrooms','EscapeTheBackrooms'],
    executables=['EscapeTheBackrooms/Binaries/WinGDK/Backrooms-WinGDK-Shipping.exe'],
    launchExecutables=['gamelaunchhelper.exe','EscapeTheBackrooms/Binaries/WinGDK/Backrooms-WinGDK-Shipping.exe'],
    xboxIdentity='SecretMode.EscapetheBackrooms',xboxDirectoryNames=['Escape the Backrooms'],
    singleInstanceProcesses=['Backrooms-WinGDK-Shipping'],detectPlatform=True,
    unsupportedPlatforms=['steam'],unsupportedPlatformReasons={'steam':'Ce module est en cours de validation sur Xbox / Game Pass. L’édition Steam nécessite sa propre préparation.'})
stage = WORK/'backrooms-stage'
for name,data in files.items():
    target = stage/name; target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
if args.register:
    common.publish_record('escape-the-backrooms',files,module,58903,installer,version=args.version,
        validation='tested-gamepass-2026-10-30' if args.validated else 'pending')
    definitions_file=ROOT/'resources/catalogs/owner-prepared-modules.json'
    definitions=json.loads(definitions_file.read_text(encoding='utf8'))
    definitions['escape-the-backrooms']['moduleDependencies']={name:sha(data) for name,data in files.items() if name.endswith(('.dll','effects.lua','json.lua'))}
    definitions_file.write_text(json.dumps(definitions,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(dict(files=len(files),module=module,moduleSha256=sha(files[module])),indent=2))

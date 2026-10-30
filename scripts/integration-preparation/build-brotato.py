"""Package the authorized game facade with the ShenPulse transport, without the original native service."""
import argparse,importlib.util,json,pathlib,re
spec=importlib.util.spec_from_file_location('pack_tools', pathlib.Path(__file__).with_name('build-script-games.py'))
pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
source=pack.CAPTURE/'s2e-modules/brotato/module.zip.extracted'
original=source/'mods/S2E-HttpBridge.zip'
expected=json.loads((pack.ROOT/'scripts/integration-preparation/script-inputs.json').read_text())['brotato']
if pack.digest(original.read_bytes())!=expected: raise ValueError('Brotato source changed')

def rebrand(text):
    return text.replace('S2E-HttpBridge','ShenPulse-Bridge').replace('StreamToEarn','ShenPulse').replace('S2E','ShenPulse').replace('s2e','shenpulse')
files={}
with pack.zipfile.ZipFile(original) as z:
    for name in ['s2e_game.gd','overlay.gd','blackout.gd','scaler.gd','extensions/main.gd']:
        files['mods-unpacked/ShenPulse-Bridge/'+name.replace('s2e','shenpulse')]=rebrand(z.read('mods-unpacked/S2E-HttpBridge/'+name).decode('utf8')).encode()
version='1.0.2'
manifest=dict(name='Bridge',namespace='ShenPulse',version_number=version,description='Interactions locales ShenPulse.',website_url='',dependencies=[],extra=dict(godot=dict(authors=['ShenPulse'],compatible_mod_loader_version=['6.0.0','6.1.0','6.2.0','6.3.0'],compatible_game_version=['1.1.15.4'],incompatibilities=[],optional_dependencies=[],load_before=[],tags=['Utilities'],config_schema={})))
files['mods-unpacked/ShenPulse-Bridge/manifest.json']=(json.dumps(manifest,indent=2)+'\n').encode()
bridge=(pack.ROOT/'scripts/integration-preparation/brotato-bridge.gd').read_text(encoding='utf8')
commands=json.loads((pack.CAPTURE/'s2e-modules/brotato/commands.json').read_text())['commands']
for command in commands:
    if '"'+command['command']+'"' not in bridge: raise ValueError('Effect has no implementation: '+command['command'])
files['mods-unpacked/ShenPulse-Bridge/mod_main.gd']=bridge.encode('utf8')
# Scene changes also clean up effects when a wave is restarted or abandoned.
extension='mods-unpacked/ShenPulse-Bridge/extensions/main.gd'
files[extension]+=b'\nfunc _change_scene(path: String) -> void:\n\t_shenpulse_notify("game_leaving")\n\t._change_scene(path)\n'
facade='mods-unpacked/ShenPulse-Bridge/shenpulse_game.gd'
facade_text=files[facade].decode('utf8')
facade_text=facade_text.replace('\tvar timer: Timer = player._invincibility_timer\n\ttimer.start(max(seconds, timer.time_left))','\tvar timer: Timer = player._invincibility_timer\n\tplayer.set_meta("shenpulse_invincible_until", OS.get_ticks_msec() + int(timer.time_left * 1000))\n\ttimer.start(max(seconds, timer.time_left))')
facade_text=facade_text.replace('\tif player != null and player._modulation_colors.has(INVINCIBLE_TINT):','\tif player != null and player.has_meta("shenpulse_invincible_until"):\n\t\tvar remaining = max(0.0, float(player.get_meta("shenpulse_invincible_until") - OS.get_ticks_msec()) / 1000.0)\n\t\tplayer.remove_meta("shenpulse_invincible_until")\n\t\tplayer._invincibility_timer.stop()\n\t\tif remaining > 0.0:\n\t\t\tplayer._invincibility_timer.start(remaining)\n\tif player != null and player._modulation_colors.has(INVINCIBLE_TINT):')
files[facade]=facade_text.encode('utf8')
module='mods/ShenPulse-Bridge.zip'
archive=pack.zip_bytes(files)
native={}
for name,data in files.items():
    leaf=name.rsplit('/',1)[-1]
    if '/extensions/' in name: continue
    text=data.decode('utf8')
    if leaf=='mod_main.gd':
        text=text.replace('ModLoaderMod.get_unpacked_dir().plus_file(MOD_DIR)','"res://mods-unpacked/shenpulse-bridge/"')
        text=text.replace('\tModLoaderMod.install_script_extension(mod_dir_path.plus_file("extensions/main.gd"))','\t# Game events are installed by the native archive adapter.')
    if leaf=='shenpulse_game.gd':
        text=re.sub(r'ModLoaderLog\.(error|warning|debug|info)\(message, LOG_NAME\)','print(message)',text)
    native[leaf]=text
payload=(json.dumps(dict(schemaVersion=1,version=version,files=native),ensure_ascii=False,indent=2)+'\n').encode('utf8')
output={module:archive,'mods/local_mods_loader.gd':rebrand((source/'mods/local_mods_loader.gd').read_text(encoding='utf8')).encode(),'override.cfg':(source/'override.cfg').read_bytes(),'ShenPulseBrotato/xbox-scripts.json':payload}
parser=argparse.ArgumentParser();parser.add_argument('--stage-only',action='store_true');args=parser.parse_args()
if args.stage_only:
    stage=pack.ROOT/'.artifacts/gamepass-tests/brotato-final'
    for name,data in output.items():
        target=stage/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    print('Brotato staged: '+str(stage))
else:
    pack.publish_record('brotato',output,module,58815,dict(directoryNames=['Brotato'],steamAppIds=['1942280'],xboxDirectoryNames=['Brotato'],xboxIdentity='19886SeavenStudio.Brotato',executables=['Brotato.exe'],launchExecutables=['gamelaunchhelper.exe','Brotato.exe'],requireLaunchExecutable=True,singleInstanceProcesses=['Brotato'],detectPlatform=True,forceSteamLaunch=True),version=version)
    definition_file=pack.ROOT/'resources/catalogs/owner-prepared-modules.json'
    definitions=json.loads(definition_file.read_text(encoding='utf8'))
    definitions['brotato']['moduleDependencies']={'ShenPulseBrotato/xbox-scripts.json':pack.digest(payload)}
    definition_file.write_text(json.dumps(definitions,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

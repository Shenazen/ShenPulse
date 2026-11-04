"""Fresh loopback-only test servers, using exact production artifacts and a separate probe."""
import hashlib, json, pathlib, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
QA = ROOT / '.artifacts/minecraft-owner-20261103'
INPUT = ROOT / '.artifacts/integration-wave-20261029/box-cyber'
JAVA = pathlib.Path('C:/Program Files/Amazon Corretto/jdk21.0.8_9/bin')
modules = json.loads((ROOT / 'resources/catalogs/owner-prepared-modules.json').read_text())
assets = json.loads((ROOT / 'scripts/manifests/game-packs.json').read_text())['assets']
classes = QA / 'probe-classes'
classes.mkdir(parents=True, exist_ok=True)
classpath = ';'.join(str(file) for file in (INPUT / 'libraries').rglob('*.jar'))
rsp = QA / 'probe.rsp'
source = ROOT / 'scripts/integration-preparation/minecraft/OwnerModeProbe.java'
rsp.write_text('\n'.join('"'+arg.replace('\\','/')+'"' for arg in ['-proc:none','-encoding','UTF-8','-classpath',classpath,'-d',str(classes),str(source)]))
subprocess.run([str(JAVA/'javac.exe'), '@'+str(rsp)], check=True)
probe = QA / 'ShenPulse-QA.jar'
with zipfile.ZipFile(probe, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in classes.rglob('*.class'): archive.write(file, file.relative_to(classes).as_posix())
    archive.writestr('plugin.yml', 'name: ShenPulse-QA\nversion: 1.0.0\nmain: fr.shenpulse.qa.OwnerModeProbe\napi-version: "1.20"\ncommands:\n  shenpulseqa:\n    description: Sonde de recette locale\n')

def extract(asset, target):
    archive = ROOT / asset['buildPath']
    if hashlib.sha256(archive.read_bytes()).hexdigest() != asset['sha256']: raise ValueError('Asset checksum mismatch')
    with zipfile.ZipFile(archive) as files:
        for member in files.namelist():
            if not (target / member).resolve().is_relative_to(target.resolve()): raise ValueError('Unsafe zip path')
        files.extractall(target)

for index, game in enumerate(['minecraft-diamond-rush', 'minecraft-box-cyber']):
    target = QA / 'servers' / game
    if '--update' in sys.argv:
        record = modules[game]
        asset = next(asset for asset in assets if asset['gameId'] == game and asset['version'] == record['version'])
        archive = ROOT / asset['buildPath']
        if hashlib.sha256(archive.read_bytes()).hexdigest() != asset['sha256']: raise ValueError('Asset checksum mismatch')
        with zipfile.ZipFile(archive) as files:
            (target / record['module']).write_bytes(files.read(record['module']))
        (target / 'plugins/ShenPulse-QA.jar').write_bytes(probe.read_bytes())
        print(game + ': isolated QA module updated')
        continue
    if (target / 'world').exists(): raise ValueError('Refusing to replace a running or existing test world')
    target.mkdir(parents=True, exist_ok=True)
    extract(next(asset for asset in assets if asset['gameId'] == 'minecraft-owner-runtime'), target)
    record = modules[game]
    extract(next(asset for asset in assets if asset['gameId'] == game and asset['version'] == record['version']), target)
    (target / 'plugins/ShenPulse-QA.jar').write_bytes(probe.read_bytes())
    # Reuse the Minecraft EULA already accepted on this PC. No user world is copied.
    eula = pathlib.Path('C:/Users/alexa/AppData/Roaming/shenpulse/games/minecraft-bedrock-box/eula.txt').read_text()
    if 'eula=true' not in eula: raise ValueError('Minecraft EULA acceptance missing')
    (target / 'eula.txt').write_text(eula)
    props = (target / 'server.properties').read_text().replace('online-mode=true', 'online-mode=false')
    props += f'\nserver-ip=127.0.0.1\nserver-port={25686+index}\nview-distance=3\nsimulation-distance=3\nmax-players=2\nlevel-seed=571331\nenforce-secure-profile=false\n'
    (target / 'server.properties').write_text(props)
    print(game + ': isolated QA server prepared')

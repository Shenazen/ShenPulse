"""Build the BALL x PIT timing correction from the pinned, previously published pack."""
import argparse
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import zipfile

spec = importlib.util.spec_from_file_location('pack_tools', pathlib.Path(__file__).with_name('build-script-games.py'))
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)


def build(compiler, cecil, version):
    source = pack.ROOT / '.artifacts/game-pack-builds/ball-x-pit/1.0.0/ball-x-pit-shenpulse-1.0.0.zip'
    if pack.digest(source.read_bytes()) != '68f468abfc0c1691b67d0dee357087988abf34127461de5bae110acc3af772db':
        raise ValueError('BALL x PIT input pack changed')
    with zipfile.ZipFile(source) as archive:
        files = {name.removeprefix('./'): archive.read(name) for name in archive.namelist() if not name.endswith('/')}
    module = 'Mods/CrowdControl.dll'
    files.pop('shenpulse-module.json', None)
    with tempfile.TemporaryDirectory(prefix='shenpulse-ball-build-') as temporary:
        stage = pathlib.Path(temporary)
        patcher = stage / 'PatchBallModule.exe'
        subprocess.run([compiler, '/nologo', '/target:exe', '/out:' + str(patcher), '/reference:' + cecil,
                        str(pathlib.Path(__file__).with_name('PatchBallModule.cs'))], check=True)
        (stage / 'Mono.Cecil.dll').write_bytes(pathlib.Path(cecil).read_bytes())
        before, after = stage / 'original.dll', stage / 'ShenPulse.dll'
        before.write_bytes(files[module])
        catalog = json.loads((pack.ROOT / 'resources/catalogs/owner-game-preparation.json').read_text(encoding='utf8'))
        game = next(game for game in catalog['games'] if game['id'] == 'ball-x-pit')
        expected = stage / 'expected-effects.txt'
        expected.write_text('\n'.join(effect['code'] for effect in game['effects']), encoding='utf8')
        subprocess.run([str(patcher), str(before), str(after), version, str(expected)], check=True)
        files[module] = after.read_bytes()
    # Keep startup diagnostics in the log without placing a console over the game.
    files['UserData/Loader.cfg'] = b'[console]\nhide_console = true\n'
    definitions = json.loads((pack.ROOT / 'resources/catalogs/owner-prepared-modules.json').read_text(encoding='utf8'))
    pack.publish_record('ball-x-pit', files, module, 58801, definitions['ball-x-pit']['installer'], version=version)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--compiler', required=True)
    parser.add_argument('--cecil', required=True)
    parser.add_argument('--version', default='1.0.2')
    args = parser.parse_args()
    build(args.compiler, args.cecil, args.version)

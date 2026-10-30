"""Standalone local browser package; no activation session or external service is included."""
import importlib.util,json,pathlib,re
spec=importlib.util.spec_from_file_location('pack_tools',pathlib.Path(__file__).with_name('build-script-games.py'))
pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
root=pack.CAPTURE/'s2e-web/Crown_Clash/game.zip.extracted'
original=(root/'index.html').read_bytes()
lock=json.loads((pack.ROOT/'scripts/integration-preparation/script-inputs.json').read_text())
if pack.digest(original)!=lock['crown-clash']:raise ValueError('Crown Clash source changed')
html=original.decode('utf8').replace('StreamToEarn','ShenPulse').replace('S2EGame','ShenPulseGame').replace('S2E','ShenPulse').replace('s2e','shenpulse').replace('"gameSlug":"Crown Clash"','"gameSlug":"crown-clash"')
if re.search(r'StreamToEarn|S2EGame|window\.S2E',html,re.I):raise ValueError('External service reference remains')
pack.publish_record('crown-clash',{'index.html':html.encode('utf8')},'index.html',58818,dict(managedTarget=True,browserGame=True,executables=[],launchExecutables=[],singleInstanceProcesses=[],requireLaunchExecutable=False))

"""Patch a source-verified UnrealScript IntConst; preserve package offsets and identities."""
import importlib.util,json,pathlib,re,struct
spec=importlib.util.spec_from_file_location('pack_tools',pathlib.Path(__file__).with_name('build-script-games.py'))
pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
lock=json.loads((pack.ROOT/'scripts/integration-preparation/script-inputs.json').read_text())

def user_strings(data):
    for encoding in ['utf8','utf-16-le']:
        old='Crowd Control'.encode(encoding);replacement='ShenPulse    '.encode(encoding)
        if len(old)!=len(replacement): raise ValueError('String width mismatch')
        data=data.replace(old,replacement)
    # Customer-facing help URLs in source literals are not game services.
    for encoding,offset in [('latin1',0),('utf-16-le',0),('utf-16-le',1)]:
        segment=data[offset:]
        if encoding=='utf-16-le': segment=segment[:len(segment)//2*2]
        text=segment.decode(encoding,errors='surrogatepass')
        for match in list(re.finditer(r'https?://[A-Za-z0-9_./#?=&%-]+',text)):
            url=match.group(0)
            if any(host in url.lower() for host in ['crowdcontrol.live','mods4ever.com','github.com/theastropath']):
                start=offset+len(text[:match.start()].encode(encoding,errors='surrogatepass'))
                old=url.encode(encoding);data=data[:start]+(' '*len(url)).encode(encoding)+data[start+len(old):]
    return data

for game_id,filename,registration,port in [('unreal-tournament-99','UT99CrowdControl.u','UT99CrowdControl.int',58816),('unreal-tournament-2004','UT2k4CrowdControl.u','UT2k4CrowdControl.ucl',58817)]:
    original=(pack.CAPTURE/filename).read_bytes()
    if pack.digest(original)!=lock[filename]: raise ValueError('Source package changed')
    # EX_IntConst 0x1d, source: Addr.port=CrowdControlPort; the compiler inlines 43384.
    anchor=b'\x1d'+struct.pack('<i',43384)
    if original.count(anchor)!=1: raise ValueError('UnrealScript port anchor changed')
    data=user_strings(original.replace(anchor,b'\x1d'+struct.pack('<i',port)))
    if len(data)!=len(original): raise ValueError('Unreal package offsets changed')
    source=(pack.CAPTURE/registration).read_text(encoding='utf8')
    source=source.replace('Crowd Control','ShenPulse')
    source=re.sub(r'FallbackDesc="[^"]*"','FallbackDesc="Interactions locales ShenPulse. Activez ce mutateur pour connecter le jeu."',source)
    module='System/'+filename
    exe='System/UnrealTournament.exe' if game_id.endswith('99') else 'System/UT2004.exe'
    pack.publish_record(game_id,{module:data,'System/'+registration:source.encode('utf8')},module,port,dict(directoryNames=['UnrealTournament','Unreal Tournament','UT2004'] if game_id.endswith('99') else ['UT2004','Unreal Tournament 2004'],steamAppIds=[],executables=[exe],launchExecutables=[exe],singleInstanceProcesses=[pathlib.PurePosixPath(exe).stem],requireLaunchExecutable=True,forceSteamLaunch=False))

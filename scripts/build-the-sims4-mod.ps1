param(
 [Parameter(Mandatory=$true)][string]$Python37,
 [string]$OutputPath=''
)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
if(!$OutputPath){$OutputPath=Join-Path $repo '.artifacts/game-pack-builds/the-sims-4/1.0.1/the-sims-4-shenpulse-1.0.1.zip'}
$build=Join-Path ([IO.Path]::GetTempPath()) ('ShenPulseSimsBuild-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($build)|Out-Null
try {
 $script=@'
import sys, pathlib, py_compile, zipfile, json, hashlib
if sys.version_info[:2] != (3,7):
    raise RuntimeError('Les Sims 4 utilisent le bytecode Python 3.7.')
root, work = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
script=work/'ShenPulse.ts4script'
with zipfile.ZipFile(str(script),'w',zipfile.ZIP_DEFLATED) as archive:
    for name,source in [('shenpulse_sims','Runtime.py'),('shenpulse_bootstrap','Bootstrap.py')]:
        file=root/'scripts/game-mods/the-sims-4'/source
        compiled=work/(name+'.pyc')
        py_compile.compile(str(file),cfile=str(compiled),dfile=name+'.py',doraise=True)
        for suffix,data in [('.pyc',compiled.read_bytes()),('.py',file.read_bytes())]:
            info=zipfile.ZipInfo(name+suffix,(2026,11,2,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            archive.writestr(info,data)
metadata={'gameId':'the-sims-4','version':'1.0.1','transport':'tcp-server','host':'127.0.0.1','port':58814,'files':[{'file':'.shenpulse-sims4-mods/ShenPulse.ts4script','sha256':hashlib.sha256(script.read_bytes()).hexdigest()}]}
with zipfile.ZipFile(str(work/'pack.zip'),'w',zipfile.ZIP_DEFLATED) as archive:
    for name,data in [('.shenpulse-sims4-mods/ShenPulse.ts4script',script.read_bytes()),('shenpulse-module.json',json.dumps(metadata,indent=2).encode())]:
        info=zipfile.ZipInfo(name,(2026,11,2,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
        archive.writestr(info,data)
print(json.dumps(metadata))
'@
 [IO.File]::WriteAllText((Join-Path $build 'build.py'),$script,[Text.UTF8Encoding]::new($false))
 & $Python37 (Join-Path $build 'build.py') $repo $build
 if($LASTEXITCODE -ne 0){throw 'Compilation du module Sims 4 échouée'}
 [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath)))|Out-Null
 Copy-Item -LiteralPath (Join-Path $build 'pack.zip') -Destination $OutputPath -Force
 Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256
} finally {
 $resolved=[IO.Path]::GetFullPath($build)
 $allowed=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
 if(!$resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe build path'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}

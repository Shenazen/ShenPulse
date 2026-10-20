param([string]$OutputPath = '', [switch]$RunTests)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$repo = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'The .NET Framework C# compiler is required.' }
if (!$OutputPath) { $OutputPath = Join-Path $repo 'resources\installer-assets\crash-bandicoot-n-sane-trilogy\1.0.1\crash-bandicoot-shenpulse-1.0.1.zip' }
$work = Join-Path $repo ('.tmp\crash-build-' + [guid]::NewGuid().ToString('N'))
$payload = Join-Path $work 'payload'
[void][IO.Directory]::CreateDirectory($payload)
$source = Join-Path $repo 'native\crash-bandicoot'
$files = @(Get-ChildItem -LiteralPath $source -File -Filter '*.cs' | Sort-Object Name | ForEach-Object { $_.FullName })
& $compiler /nologo /codepage:65001 /target:winexe /platform:x64 /optimize+ /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll ('/out:' + (Join-Path $payload 'ShenPulse.CrashBridge.exe')) @files
if ($LASTEXITCODE -ne 0) { throw 'Crash bridge compilation failed.' }
[IO.File]::WriteAllText((Join-Path $payload 'ShenPulse.CrashBridge.README.txt'), "ShenPulse Crash Bandicoot 1.0.1`r`nPont original autonome. Windows x64, Steam 731490 / build 2964270.`r`nLancement via Steam ; attente de la fenetre stable du jeu. Le pont rejoint aussi un jeu deja lance.`r`n26 interactions, TCP sortant 127.0.0.1:58436. Aucun service tiers requis.`r`nL'executable original du jeu et les sauvegardes ne sont pas modifies par l'installation.`r`nLes compteurs modifies en partie peuvent etre sauvegardes par le jeu.`r`nLes effets temporaires sont restaures a expiration, en pause et a la deconnexion.`r`n", [Text.UTF8Encoding]::new($false))
if ($RunTests) {
  $codesPath = Join-Path $work 'codes.txt'
  $catalogScript = Join-Path $repo 'src\main\crash-bandicoot-catalog.js'
  $codes = & node -p "require(process.argv[1]).CRASH_BANDICOOT_EFFECTS.map(e=>e.code).join(String.fromCharCode(10))" $catalogScript
  [IO.File]::WriteAllText($codesPath, ($codes -join "`n"), [Text.UTF8Encoding]::new($false))
  $harness = Join-Path $work 'CrashTests.exe'
  & $compiler /nologo /codepage:65001 /target:exe /platform:x64 /main:Harness /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll ('/out:' + $harness) @files (Join-Path $source 'Tests\Harness.cs')
  if ($LASTEXITCODE -ne 0) { throw 'Crash tests compilation failed.' }
  & $harness $codesPath
  if ($LASTEXITCODE -ne 0) { throw 'Crash native tests failed.' }
}
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $OutputPath))
$temporaryZip = Join-Path $work 'crash.zip'
$zip = [IO.Compression.ZipFile]::Open($temporaryZip, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in (Get-ChildItem -LiteralPath $payload -File | Sort-Object Name)) {
    $entry = $zip.CreateEntry($file.Name, [IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = [DateTimeOffset]::new(2026,10,20,0,0,0,[TimeSpan]::Zero)
    $inputStream = [IO.File]::OpenRead($file.FullName); $outputStream = $entry.Open()
    try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  }
} finally { $zip.Dispose() }
Copy-Item -LiteralPath $temporaryZip -Destination $OutputPath -Force
[pscustomobject]@{Path=$OutputPath;Size=(Get-Item -LiteralPath $OutputPath).Length;SHA256=(Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant() } | ConvertTo-Json -Compress

param(
  [string] $BaseArchive = '',
  [string] $CecilPackage = '',
  [string] $OutputPath = '',
  [Parameter(Mandatory=$true)][string] $InteropDirectory,
  [Parameter(Mandatory=$true)][string] $Compiler,
  [string] $RuntimeDirectory = 'C:/Program Files/dotnet/shared/Microsoft.NETCore.App/6.0.36'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (!$OutputPath) { $OutputPath = Join-Path $repo '.artifacts/game-pack-builds/the-mortuary-assistant/1.0.2/the-mortuary-assistant-shenpulse-1.0.2.zip' }
$work = Join-Path $repo ('.tmp/mortuary-build-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($work) | Out-Null
function AssertHash([string] $file, [string] $hash) {
  if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $hash) { throw ('Unexpected input SHA256: ' + $file) }
}
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  # Build from our immutable, verified ShenPulse baseline; no third-party service is needed.
  if (!$BaseArchive) {
    $BaseArchive = Join-Path $work 'base.zip'
    Invoke-WebRequest -UseBasicParsing 'https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/the-mortuary-assistant/1.0.0/the-mortuary-assistant-shenpulse-1.0.0.zip' -OutFile $BaseArchive
  }
  AssertHash $BaseArchive 'bd43b6cf4beb09d0dcbb10c424e116e2c7e5b75bdee92b539471179ef13b5505'
  if (!$CecilPackage) {
    $CecilPackage = Join-Path $work 'cecil.zip'
    Invoke-WebRequest -UseBasicParsing 'https://api.nuget.org/v3-flatcontainer/mono.cecil/0.11.6/mono.cecil.0.11.6.nupkg' -OutFile $CecilPackage
  }
  AssertHash $CecilPackage 'd2a23832aaa948ba9a01acc42b5726e34c5f995958f1b30d45c0e7c70b3a72d5'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path $CecilPackage).Path, (Join-Path $work 'cecil'))
  [Reflection.Assembly]::Load([IO.File]::ReadAllBytes((Join-Path $work 'cecil/lib/net40/Mono.Cecil.dll'))) | Out-Null
  $payload = Join-Path $work 'payload'
  [IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path $BaseArchive).Path, $payload)
  & (Join-Path $PSScriptRoot 'game-mods/the-mortuary-assistant/apply-corrections.ps1') -Payload $payload -InteropDirectory $InteropDirectory -Compiler $Compiler -RuntimeDirectory $RuntimeDirectory
  $notice = Join-Path $payload 'MelonLoader/Documentation/ShenPulse-NOTICES.txt'
  [IO.File]::AppendAllText($notice, "
ShenPulse installer 1.0.2, 2026-11-02: game 3.0.2 fixes for exact inventory IDs,
machine inventory-slot selection and restored controls, actual possession progress,
and guaranteed demonic event attempts. Original authors and licenses retained.
", [Text.UTF8Encoding]::new($false))
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) | Out-Null
  $stream = [IO.File]::Open($OutputPath, [IO.FileMode]::Create)
  $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in (Get-ChildItem -LiteralPath $payload -Recurse -File | Sort-Object FullName)) {
      $relative = $file.FullName.Substring($payload.Length + 1).Replace('\', '/')
      $entry = $zip.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
      $entryStream = $entry.Open()
      try { $bytes = [IO.File]::ReadAllBytes($file.FullName); $entryStream.Write($bytes, 0, $bytes.Length) }
      finally { $entryStream.Dispose() }
    }
  } finally { $zip.Dispose(); $stream.Dispose() }
  Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256
  (Get-Item -LiteralPath $OutputPath).Length
} finally {
  $resolvedWork = [IO.Path]::GetFullPath($work)
  $allowedRoot = [IO.Path]::GetFullPath((Join-Path $repo '.tmp')) + [IO.Path]::DirectorySeparatorChar
  if (!$resolvedWork.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary directory.' }
  Remove-Item -LiteralPath $resolvedWork -Recurse -Force
}

# Bytes-only persistent Windows OCR worker. No screen capture, paths from input,
# image files, network request or diagnostic logging. Parent enforces deadlines.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Await-Operation($Operation, [Type]$ResultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Length -eq 1 -and
        $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    if ($null -eq $method) { throw 'Unavailable' }
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(10000)) { throw 'Unavailable' }
    return $task.Result
}

$engine = $null
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.DataWriter, Windows.Foundation, ContentType = WindowsRuntime]
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
} catch { $engine = $null }

while ($null -ne ($line = [Console]::ReadLine())) {
    # A request contains at most a 2 MiB PNG, encoded as JSON/base64.
    if ($line.Length -gt 2800000) { break }
    $request = $null; $stream = $null; $writer = $null; $bitmap = $null; $bytes = $null
    try {
        $request = ConvertFrom-Json -InputObject $line
        if ($request.id -isnot [long] -and $request.id -isnot [int]) { throw 'Unavailable' }
        if ($request.id -le 0 -or $request.id -gt 9007199254740991 -or $request.png -isnot [string] -or $null -eq $engine) { throw 'Unavailable' }
        $bytes = [Convert]::FromBase64String($request.png)
        if ($bytes.Length -lt 33 -or $bytes.Length -gt 2097152) { throw 'Unavailable' }
        $signature = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
        for ($index = 0; $index -lt 8; $index++) { if ($bytes[$index] -ne $signature[$index]) { throw 'Unavailable' } }
        $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
        $writer = New-Object Windows.Storage.Streams.DataWriter($stream)
        $writer.WriteBytes($bytes)
        $null = Await-Operation ($writer.StoreAsync()) ([uint32])
        $null = $writer.DetachStream()
        $writer.Dispose(); $writer = $null
        $stream.Seek(0)
        $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $maximum = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
        if ($decoder.PixelWidth -le 0 -or $decoder.PixelHeight -le 0 -or $decoder.PixelWidth -gt $maximum -or
            $decoder.PixelHeight -gt $maximum -or [long]$decoder.PixelWidth * $decoder.PixelHeight -gt 4000000) { throw 'Unavailable' }
        $bitmap = Await-Operation ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
            [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $result = Await-Operation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        $lines = @()
        foreach ($ocrLine in $result.Lines) {
            if ($lines.Count -ge 64) { throw 'Unavailable' }
            $text = [string]$ocrLine.Text
            if ($text.Length -gt 512) { throw 'Unavailable' }
            $left = [double]::PositiveInfinity; $top = [double]::PositiveInfinity
            $right = 0.0; $bottom = 0.0
            foreach ($word in $ocrLine.Words) {
                $box = $word.BoundingRect
                $left = [Math]::Min($left, $box.X); $top = [Math]::Min($top, $box.Y)
                $right = [Math]::Max($right, $box.X + $box.Width); $bottom = [Math]::Max($bottom, $box.Y + $box.Height)
            }
            if (-not [double]::IsInfinity($left)) {
                $lines += @{ text = $text; bbox = @{ x = $left; y = $top; width = $right - $left; height = $bottom - $top } }
            }
        }
        $response = @{ id = $request.id; available = $true; lines = @($lines) }
    } catch {
        $response = @{ id = $request.id; available = $false; lines = @() }
    } finally {
        if ($null -ne $bitmap) { $bitmap.Dispose() }
        if ($null -ne $writer) { $writer.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
        $line = $null; $request = $null; $bytes = $null; $result = $null; $decoder = $null; $lines = $null
    }
    [Console]::WriteLine((ConvertTo-Json -InputObject $response -Depth 5 -Compress))
    [Console]::Out.Flush()
    $response = $null
}

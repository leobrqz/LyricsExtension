$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'release_artifacts.ps1')
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot
try {
    $product = Get-ReleaseProduct $projectRoot
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npmCommand) { $npmCommand = Get-Command npm -ErrorAction Stop }
    & $npmCommand.Source run package
    if ($LASTEXITCODE -ne 0) { throw 'Extension build or packaging failed.' }
    $directory = Join-Path $projectRoot 'artifacts/release'
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $sourceArchive = Join-Path $projectRoot "artifacts/lyrics_extension-$($product.Version).zip"
    $archivePath = Join-Path $directory 'LyricsExtension-Firefox-unsigned.zip'
    Copy-Item -LiteralPath $sourceArchive -Destination $archivePath -Force
    $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $directory 'SHA256SUMS.txt'), "$hash  LyricsExtension-Firefox-unsigned.zip`n", [Text.Encoding]::ASCII)
    $verified = @(Assert-ReleaseArtifacts $directory $product)
    Write-Output "Prepared v$($product.Version): unsigned Firefox ZIP and SHA-256 checksum."
    Write-Output $verified
} finally { Pop-Location }

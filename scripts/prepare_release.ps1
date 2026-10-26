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
    $sourceArchive = Join-Path $projectRoot "artifacts/lyrics_please-$($product.Version).zip"
    $verified = @(Write-ReleaseArtifacts $directory $sourceArchive $product)
    Write-Output "Prepared v$($product.Version): Firefox ZIP, Mozilla Store upload ZIP, and SHA-256 checksums."
    Write-Output $verified
} finally { Pop-Location }

param([string]$PackageFile)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
. (Join-Path $PSScriptRoot 'release_artifacts.ps1')

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$product = Get-ReleaseProduct $projectRoot
if (-not $PackageFile) { $PackageFile = Join-Path $projectRoot "artifacts/lyrics_please-$($product.Version).zip" }
$packagePath = (Resolve-Path -LiteralPath $PackageFile).Path
$packageName = Split-Path -Leaf $packagePath
$packageHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) { $npmCommand = Get-Command npm -ErrorAction Stop }
$nodeVersion = (& node --version).Trim()
$npmVersion = (& $npmCommand.Source --version).Trim()

$outputRoot = Join-Path $projectRoot 'artifacts/amo'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$workRoot = Join-Path $outputRoot ('.source-' + [Guid]::NewGuid().ToString('N'))
$sourceRoot = Join-Path $workRoot 'src'
$verifyRoot = Join-Path $workRoot 'check'
$candidatePath = Join-Path $workRoot 'source.zip'
$archivePath = Join-Path $outputRoot "LyricsPlease-v$($product.Version)-source.zip"
New-Item -ItemType Directory -Path $sourceRoot | Out-Null

try {
    foreach ($directory in @('src', 'scripts', 'tests', 'public')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $directory) -Destination $sourceRoot -Recurse
    }
    foreach ($file in @('package.json', 'package-lock.json', 'README.md', 'LICENSE', '.gitignore')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $sourceRoot
    }
    $instructions = @"
# Build instructions

Version: $($product.Version)
Verified on Windows ($([Runtime.InteropServices.RuntimeInformation]::OSArchitecture)), Node.js $nodeVersion and npm $npmVersion.
Install Node.js from https://nodejs.org/en/download. npm is included.

From this folder, run:

``````sh
npm ci
npm run build
``````

The extension files are generated in dist/. Firefox is not needed to build.
On Windows PowerShell, use npm.cmd if script execution is restricted.

scripts/build.mjs bundles the app and adapts the Bergamot browser worker
to remove its Node shim and load the packaged WASM file offline.
Translation models are downloaded at runtime and are not needed for the build.

Reference package: $packageName
SHA-256: $packageHash

Compare dist/ with the extracted reference package.
README.md is included in the extension unchanged; this file is for review only.
"@
    [IO.File]::WriteAllText((Join-Path $sourceRoot 'README-AMO.md'), $instructions.Replace("`r`n", "`n") + "`n", [Text.UTF8Encoding]::new($false))

    $archive = [IO.Compression.ZipFile]::Open($candidatePath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force | Sort-Object FullName) {
            $relative = $file.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $archive.Dispose() }

    [IO.Compression.ZipFile]::ExtractToDirectory($candidatePath, $verifyRoot)
    Push-Location $verifyRoot
    try {
        & $npmCommand.Source ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Source dependency installation failed.' }
        & $npmCommand.Source run build
        if ($LASTEXITCODE -ne 0) { throw 'Source build failed.' }
    } finally { Pop-Location }

    $reference = [IO.Compression.ZipFile]::OpenRead($packagePath)
    try {
        $names = @()
        $distRoot = Join-Path $verifyRoot 'dist'
        foreach ($entry in $reference.Entries) {
            if ($entry.Name -eq '') { continue }
            if ($entry.FullName -match '^[/\\]|\\|(^|/)\.\.(/|$)|:') { throw 'Unsafe reference package path.' }
            $names += $entry.FullName
            $builtPath = Join-Path $distRoot $entry.FullName
            if (-not (Test-Path -LiteralPath $builtPath -PathType Leaf)) { throw "Source build is missing $($entry.FullName)." }
            $stream = $entry.Open()
            $hasher = [Security.Cryptography.SHA256]::Create()
            try { $entryHash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
            finally { $hasher.Dispose(); $stream.Dispose() }
            $builtHash = (Get-FileHash -LiteralPath $builtPath -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($entryHash -ne $builtHash) { throw "Source build differs from the submitted package: $($entry.FullName)." }
        }
        $builtNames = @(Get-ChildItem -LiteralPath $distRoot -File -Recurse | ForEach-Object { $_.FullName.Substring($distRoot.Length + 1).Replace('\', '/') })
        if (Compare-Object $names $builtNames) { throw 'Source build has a different file list.' }
    } finally { $reference.Dispose() }

    Copy-Item -LiteralPath $candidatePath -Destination $archivePath -Force
    Write-Output "Source ZIP verified against $($names.Count) extension files."
    Write-Output $archivePath
} finally {
    $absoluteWork = [IO.Path]::GetFullPath($workRoot)
    $absoluteOutput = [IO.Path]::GetFullPath($outputRoot)
    if (-not $absoluteWork.StartsWith($absoluteOutput + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $absoluteWork) -notmatch '^\.source-[a-f0-9]{32}$') { throw 'Refusing to remove a directory outside the source workspace.' }
    Remove-Item -LiteralPath $absoluteWork -Recurse -Force
}

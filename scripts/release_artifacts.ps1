$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ReleaseProduct([string]$Root) {
    $package = Get-Content -Raw -LiteralPath (Join-Path $Root 'package.json') | ConvertFrom-Json
    $lockVersions = & node -p 'JSON.stringify([require(process.argv[1]).version,require(process.argv[1]).packages[String()].version])' (Join-Path $Root 'package-lock.json') | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or @($lockVersions).Count -ne 2) { throw 'Cannot read lockfile versions.' }
    $manifest = Get-Content -Raw -LiteralPath (Join-Path $Root 'src/manifest.json') | ConvertFrom-Json
    $version = $package.version
    if ($version -notmatch '^\d+\.\d+\.\d+$' -or $manifest.version -ne $version -or
        $lockVersions[0] -ne $version -or $lockVersions[1] -ne $version) {
        throw 'package.json, package-lock.json, and src/manifest.json must use the same semantic version.'
    }
    return @{ Version = $version; Id = $manifest.browser_specific_settings.gecko.id }
}

function Read-ReleaseZipText([IO.Compression.ZipArchive]$Archive, [string]$Name) {
    $entry = $Archive.GetEntry($Name)
    if (-not $entry) { throw "Missing archive entry: $Name" }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Get-ReleasePackageNames([hashtable]$Product) {
    return @("LyricsPlease-v$($Product.Version)-firefox-unsigned.zip", "LyricsPlease-v$($Product.Version)-mozilla-store.zip")
}

function Write-ReleaseArtifacts([string]$Directory, [string]$SourceArchive, [hashtable]$Product) {
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    $hash = (Get-FileHash -LiteralPath $SourceArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    $sums = @()
    foreach ($name in Get-ReleasePackageNames $Product) {
        Copy-Item -LiteralPath $SourceArchive -Destination (Join-Path $Directory $name) -Force
        $sums += "$hash  $name"
    }
    [IO.File]::WriteAllText((Join-Path $Directory 'SHA256SUMS.txt'), ($sums -join "`n") + "`n", [Text.Encoding]::ASCII)
    return @(Assert-ReleaseArtifacts $Directory $Product)
}

function Assert-ReleaseArtifacts([string]$Directory, [hashtable]$Product) {
    $packageNames = @(Get-ReleasePackageNames $Product)
    $packagePaths = @($packageNames | ForEach-Object { Join-Path $Directory $_ })
    $sumsPath = Join-Path $Directory 'SHA256SUMS.txt'
    $sums = @([IO.File]::ReadAllLines($sumsPath) | Where-Object { $_.Trim() })
    if ($sums.Count -ne $packageNames.Count) {
        throw 'The checksum file must contain the Firefox and Mozilla Store ZIPs.'
    }
    $hashes = @()
    for ($index = 0; $index -lt $packageNames.Count; $index++) {
        if ($sums[$index] -notmatch '^([a-fA-F0-9]{64})  (.+)$' -or $Matches[2] -cne $packageNames[$index]) {
            throw "Invalid checksum entry for $($packageNames[$index])."
        }
        $expectedHash = $Matches[1]
        $hash = (Get-FileHash -LiteralPath $packagePaths[$index] -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hash -ne $expectedHash) { throw "SHA-256 mismatch: $($packageNames[$index])." }
        $hashes += $hash
    }
    if ($hashes[0] -ne $hashes[1]) { throw 'The Firefox and Mozilla Store ZIPs must be identical.' }
    $archive = [IO.Compression.ZipFile]::OpenRead($packagePaths[0])
    try {
        $names = @($archive.Entries | ForEach-Object { $_.FullName })
        foreach ($name in @('manifest.json', 'popup.html', 'app.js', 'background.js', 'styles.css', 'icons/icon.svg',
                '_locales/en/messages.json', '_locales/pt_BR/messages.json', 'README.md', 'LICENSE')) {
            if ($names -notcontains $name) { throw "Missing archive entry: $name" }
        }
        if (@($names | Sort-Object -Unique).Count -ne $names.Count) { throw 'Duplicate archive entries are not allowed.' }
        foreach ($name in $names) {
            if ($name -match '(^|/)\.\.(/|$)|^[/\\]|\\' -or
                ($name -notmatch '^(manifest\.json|popup\.html|app\.js|background\.js|styles\.css|README\.md|LICENSE)$' -and
                 $name -notmatch '^(icons|_locales|licenses)/' -and
                 $name -notmatch '^bergamot/(translator-worker\.js|bergamot-translator-worker\.(js|wasm))?$')) { throw "Unexpected archive entry: $name" }
        }
        $manifestText = Read-ReleaseZipText $archive 'manifest.json'
        $manifest = $manifestText | ConvertFrom-Json
        if ($manifest.version -ne $Product.Version -or $manifest.browser_specific_settings.gecko.id -ne $Product.Id) {
            throw 'The packaged manifest does not match the product version and extension ID.'
        }
        $expectedHosts = @('https://api.lyrics.ovh/*', 'https://www.letras.mus.br/*', 'https://letras.mus.br/*')
        if (Compare-Object $expectedHosts @($manifest.host_permissions)) { throw 'Unexpected production host permissions.' }
        $expectedOptionalHosts = @('https://api.mymemory.translated.net/*', 'https://bergamot.s3.amazonaws.com/*',
            'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/*')
        if (Compare-Object $expectedOptionalHosts @($manifest.optional_host_permissions)) { throw 'Unexpected optional translation host permissions.' }
        if ($manifestText -match 'localhost|127\.0\.0\.1') { throw 'Test endpoints must not be distributed.' }
        $readme = Read-ReleaseZipText $archive 'README.md'
        if (-not $readme.Contains('## Privacy') -or -not $readme.Contains('Copyright (c) Basile Bruneau') -or
            -not $readme.Contains('The above copyright notice and this permission notice shall be included')) {
            throw 'The package must preserve privacy information and dependency notices.'
        }
        if (-not (Read-ReleaseZipText $archive 'LICENSE').StartsWith('MIT License')) { throw 'Missing project MIT license.' }
        foreach ($name in @('bergamot/translator-worker.js', 'bergamot/bergamot-translator-worker.js',
                'bergamot/bergamot-translator-worker.wasm', 'licenses/Bergamot-MPL-2.0.txt', 'licenses/franc-MIT.txt',
                'licenses/trigram-utils-MIT.txt', 'licenses/n-gram-MIT.txt', 'licenses/collapse-white-space-MIT.txt')) {
            if ($names -notcontains $name) { throw "Missing translation engine asset or license: $name" }
        }
    } finally { $archive.Dispose() }
    return @($packagePaths) + @($sumsPath)
}

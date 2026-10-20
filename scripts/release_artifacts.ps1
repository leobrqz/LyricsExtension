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

function Assert-ReleaseArtifacts([string]$Directory, [hashtable]$Product) {
    $packageName = 'LyricsExtension-Firefox-unsigned.zip'
    $packagePath = Join-Path $Directory $packageName
    $sumsPath = Join-Path $Directory 'SHA256SUMS.txt'
    $sums = @([IO.File]::ReadAllLines($sumsPath) | Where-Object { $_.Trim() })
    if ($sums.Count -ne 1 -or $sums[0] -notmatch '^([a-fA-F0-9]{64})  LyricsExtension-Firefox-unsigned\.zip$') {
        throw 'The checksum file must contain exactly the unsigned Firefox ZIP.'
    }
    if ((Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash -ne $Matches[1]) {
        throw 'The Firefox ZIP does not match its SHA-256 checksum.'
    }
    $archive = [IO.Compression.ZipFile]::OpenRead($packagePath)
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
                 $name -notmatch '^(icons|_locales)/')) { throw "Unexpected archive entry: $name" }
        }
        $manifestText = Read-ReleaseZipText $archive 'manifest.json'
        $manifest = $manifestText | ConvertFrom-Json
        if ($manifest.version -ne $Product.Version -or $manifest.browser_specific_settings.gecko.id -ne $Product.Id) {
            throw 'The packaged manifest does not match the product version and extension ID.'
        }
        $expectedHosts = @('https://api.lyrics.ovh/*', 'https://www.letras.mus.br/*', 'https://letras.mus.br/*')
        if (Compare-Object $expectedHosts @($manifest.host_permissions)) { throw 'Unexpected production host permissions.' }
        if ($manifestText -match 'localhost|127\.0\.0\.1') { throw 'Test endpoints must not be distributed.' }
        $readme = Read-ReleaseZipText $archive 'README.md'
        if (-not $readme.Contains('## Privacy') -or -not $readme.Contains('Copyright (c) Basile Bruneau') -or
            -not $readme.Contains('The above copyright notice and this permission notice shall be included')) {
            throw 'The package must preserve privacy information and dependency notices.'
        }
        if (-not (Read-ReleaseZipText $archive 'LICENSE').StartsWith('MIT License')) { throw 'Missing project MIT license.' }
    } finally { $archive.Dispose() }
    return @($packagePath, $sumsPath)
}

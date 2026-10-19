param(
    [Parameter(Mandatory = $true)][string]$NotesFile,
    [string]$Title,
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'release_artifacts.ps1')

function Invoke-GitChecked([string[]]$CommandArgs) {
    $result = & git @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "Git command failed: git $($CommandArgs -join ' ')" }
    return $result
}

function Invoke-GhChecked([string[]]$CommandArgs) {
    $result = & gh @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "GitHub command failed: gh $($CommandArgs -join ' ')" }
    return $result
}

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot
try {
    $product = Get-ReleaseProduct $projectRoot
    $tag = "v$($product.Version)"
    if (-not $Title) { $Title = "$tag - Lyrics Extension preview" }
    if (-not $Title.Contains($product.Version)) { throw 'The release title must include the version.' }
    $notesPath = (Resolve-Path -LiteralPath $NotesFile).Path
    if (-not [IO.File]::ReadAllText($notesPath).Trim()) { throw 'Release notes cannot be empty.' }
    if ((Invoke-GitChecked @('branch', '--show-current')) -ne 'main') { throw 'Publish releases from main.' }
    $directory = Join-Path $projectRoot 'artifacts/release'
    $artifacts = @(Assert-ReleaseArtifacts $directory $product)
    if ($ValidateOnly) { Write-Output "Validated $tag, package contents, version, production endpoints, and SHA-256 checksum."; return }
    if (Invoke-GitChecked @('status', '--porcelain')) { throw 'Commit intended changes before publishing.' }
    $repository = (Invoke-GhChecked @('repo', 'view', '--json', 'nameWithOwner') | ConvertFrom-Json).nameWithOwner
    $headCommit = Invoke-GitChecked @('rev-parse', 'HEAD')
    $releases = @(Invoke-GhChecked @('release', 'list', '--repo', $repository, '--limit', '100', '--json', 'tagName,isDraft') | ConvertFrom-Json)
    $existing = $releases | Where-Object { $_.tagName -eq $tag }
    if ($existing -and -not $existing.isDraft) { throw 'Published releases are immutable. Use a new version.' }
    $localTags = @(Invoke-GitChecked @('tag', '--list', $tag))
    if ($localTags.Count) {
        if ((Invoke-GitChecked @('cat-file', '-t', "refs/tags/$tag")) -ne 'tag' -or
            (Invoke-GitChecked @('rev-list', '-n', '1', $tag)) -ne $headCommit) {
            throw 'The existing tag must annotate the current release commit.'
        }
    } else {
        $remoteTag = Invoke-GitChecked @('ls-remote', '--tags', 'origin', "refs/tags/$tag", "refs/tags/$tag^{}")
        if ($remoteTag) { throw 'The remote tag already exists. Fetch it and verify its release commit.' }
        Invoke-GitChecked @('tag', '-a', $tag, '-m', $Title)
    }
    Invoke-GitChecked @('push', 'origin', 'main', "refs/tags/$tag")
    if (-not $existing) {
        Invoke-GhChecked @('release', 'create', $tag, '--repo', $repository, '--verify-tag', '--draft', '--title', $Title, '--notes-file', $notesPath)
    }
    $remote = Invoke-GhChecked @('release', 'view', $tag, '--repo', $repository, '--json', 'isDraft,assets') | ConvertFrom-Json
    if (-not $remote.isDraft) { throw 'Only draft releases can receive assets.' }
    $expectedNames = @($artifacts | ForEach-Object { Split-Path -Leaf $_ })
    foreach ($asset in $remote.assets) {
        if ($expectedNames -notcontains $asset.name) { throw 'Unexpected draft attachment. Review it before publishing.' }
    }
    foreach ($artifact in $artifacts) {
        $name = Split-Path -Leaf $artifact
        if (@($remote.assets).name -notcontains $name) {
            Invoke-GhChecked @('release', 'upload', $tag, $artifact, '--repo', $repository)
        }
    }
    $verification = Join-Path $projectRoot "artifacts/release-verification/$tag"
    New-Item -ItemType Directory -Path $verification -Force | Out-Null
    Invoke-GhChecked @('release', 'download', $tag, '--repo', $repository, '--dir', $verification, '--clobber')
    foreach ($artifact in $artifacts) {
        $downloaded = Join-Path $verification (Split-Path -Leaf $artifact)
        if ((Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash -ne
            (Get-FileHash -LiteralPath $downloaded -Algorithm SHA256).Hash) {
            throw 'Downloaded attachment does not match the local release. The release remains a draft.'
        }
    }
    $null = Assert-ReleaseArtifacts $verification $product
    $remote = Invoke-GhChecked @('release', 'view', $tag, '--repo', $repository, '--json', 'isDraft,assets') | ConvertFrom-Json
    if (-not $remote.isDraft -or @($remote.assets).Count -ne $artifacts.Count) { throw 'Draft verification failed.' }
    Invoke-GhChecked @('release', 'edit', $tag, '--repo', $repository, '--draft=false', '--latest', '--title', $Title, '--notes-file', $notesPath)
    $published = Invoke-GhChecked @('release', 'view', $tag, '--repo', $repository, '--json', 'url,isDraft,assets') | ConvertFrom-Json
    if ($published.isDraft -or @($published.assets).Count -ne $artifacts.Count) { throw 'Publication verification failed.' }
    Write-Output $published.url
} finally { Pop-Location }

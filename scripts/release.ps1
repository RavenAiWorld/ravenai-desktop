param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [string]$Notes = "",

  [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

$displayTag = if ($Version -eq '1.0.0') { 'v1.00 (v1.0.0)' } else { "v$Version" }
$gitTag = "v$Version"

Write-Host "=== 1. Bump version to $Version across package.json, Cargo.toml, tauri.conf.json ==="
$pkgPath = Join-Path $root 'package.json'
$pkgRaw = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8
$pkgRaw = [regex]::Replace($pkgRaw, '("version"\s*:\s*)"[^"]+"', "`$1`"$Version`"", 1)
[System.IO.File]::WriteAllText($pkgPath, $pkgRaw, (New-Object System.Text.UTF8Encoding($false)))

$cargoPath = Join-Path $root 'src-tauri\Cargo.toml'
$cargoRaw = Get-Content -LiteralPath $cargoPath -Raw -Encoding UTF8
$cargoRaw = [regex]::Replace($cargoRaw, '(?m)^version\s*=\s*"[^"]+"', "version = `"$Version`"", 1)
[System.IO.File]::WriteAllText($cargoPath, $cargoRaw, (New-Object System.Text.UTF8Encoding($false)))

$tauriPath = Join-Path $root 'src-tauri\tauri.conf.json'
$tauriRaw = Get-Content -LiteralPath $tauriPath -Raw -Encoding UTF8
$tauriRaw = [regex]::Replace($tauriRaw, '("version"\s*:\s*)"[^"]+"', "`$1`"$Version`"", 1)
[System.IO.File]::WriteAllText($tauriPath, $tauriRaw, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "=== 2. Run checks, unit tests, Rust tests, and build ==="
npm run check; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo test --manifest-path src-tauri/Cargo.toml --lib; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== 3. Archive source & build NSIS installer ==="
powershell -NoProfile -File scripts/source-archive.ps1; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run package; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$installer = Join-Path $root "src-tauri\target\release\bundle\nsis\Ravenai_${Version}_x64-setup.exe"
if (-not (Test-Path -LiteralPath $installer)) {
  throw "Expected installer not found: $installer"
}

$hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
$assetName = Split-Path -Leaf $installer
$sumsPath = Join-Path $root "src-tauri\target\release\bundle\nsis\SHA256SUMS.txt"
[System.IO.File]::WriteAllText($sumsPath, "$hash  $assetName`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Built installer: $assetName ($((Get-Item $installer).Length) bytes)"
Write-Host "SHA256: $hash"

if ($SkipPush) {
  Write-Host "SkipPush enabled; stopping before git tag and GitHub Release."
  exit 0
}

Write-Host "=== 4. Commit, tag $gitTag, push & publish GitHub Release ==="
git add -A
$dirty = git status --porcelain
if ($dirty) {
  git commit -m "release: Ravenai Desktop $displayTag"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
git tag -f $gitTag
git push origin HEAD --follow-tags
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$releaseNotes = if ($Notes) { $Notes } else {
  "Ravenai Desktop $displayTag`n`n- Windows x64 安装包：``$assetName```n- SHA256：``$hash```n- 支持客户端内自动检测更新、SHA256 校验与一键静默升级。"
}
$notesFile = Join-Path $env:TEMP "ravenai-release-notes-$Version.md"
[System.IO.File]::WriteAllText($notesFile, $releaseNotes, (New-Object System.Text.UTF8Encoding($false)))

gh release create $gitTag $installer $sumsPath --title "Ravenai Desktop $displayTag" --notes-file $notesFile --latest
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item -LiteralPath $notesFile -ErrorAction SilentlyContinue
Write-Host "=== Published GitHub Release $gitTag successfully! ==="

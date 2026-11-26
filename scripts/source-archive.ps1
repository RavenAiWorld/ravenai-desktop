$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $projectRoot 'release-source.zip'
Add-Type -AssemblyName System.IO.Compression
function Get-SourceFiles([string]$directory) {
  foreach ($child in (Get-ChildItem -LiteralPath $directory)) {
    if ($child.PSIsContainer) { if ($child.Name -notin @('target', 'gen', 'node_modules', '.next', '.vite')) { Get-SourceFiles $child.FullName } }
    else { $child }
  }
}
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $paths = @('client', 'studio', 'src-tauri', 'assets', 'docs', 'tests', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'tsconfig.json', 'LICENSE', 'NOTICE.md', 'README.md', 'AGENTS.md', 'scripts/source-archive.ps1', 'scripts/release.ps1', 'scripts/sync-pricing.mjs')
  foreach ($relative in $paths) {
    $item = Get-Item -LiteralPath (Join-Path $projectRoot $relative)
    $files = if ($item.PSIsContainer) { Get-SourceFiles $item.FullName } else { @($item) }
    foreach ($file in $files) {
      $entryName = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
      $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $inputStream = [System.IO.File]::OpenRead($file.FullName)
      $outputStream = $entry.Open()
      try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
    }
  }
} finally { $archive.Dispose(); $stream.Dispose() }
Get-Item -LiteralPath $archivePath | Select-Object Name, Length

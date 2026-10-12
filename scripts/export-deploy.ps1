<#
.SYNOPSIS
  Package Sky Striker for a manual Dokploy upload (Application → Source: Drop, Build type: Dockerfile).

.DESCRIPTION
  Writes export/sky-striker.zip containing exactly what the root Dockerfile needs to build the
  single image (game + API). Secrets, node_modules and build output are never included — set
  environment variables in Dokploy instead (see DEPLOY.md).
  Entries use forward slashes so the archive extracts correctly on Linux build hosts.

.EXAMPLE
  npm run export:zip
  powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/export-deploy.ps1 -OutFile export/custom.zip
#>
param(
  [string]$OutFile = 'export/sky-striker.zip'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# Files / folders the Docker build uses (relative to repo root)
$include = @(
  'Dockerfile', '.dockerignore',
  'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json',
  'public', 'src',
  'server/package.json', 'server/package-lock.json', 'server/tsconfig.json', 'server/tsconfig.build.json',
  'server/nest-cli.json', 'server/start.sh', 'server/src'
)

# Never ship these, wherever they appear
$excludeDirs = @('node_modules', 'dist', '.git', '.shots', 'export')
$excludeFile = { param($name) $name -like '.env*' -and $name -ne '.env.example' -or $name -like '*.log' -or $name -like '*.tsbuildinfo' -or $name -like '*.spec.ts' }

function Get-PackFiles([string]$rel) {
  $full = Join-Path $root $rel
  if (-not (Test-Path $full)) { throw "Missing required path: $rel" }
  $item = Get-Item -LiteralPath $full -Force
  if (-not $item.PSIsContainer) { return , $item }
  Get-ChildItem -LiteralPath $full -Recurse -File -Force | Where-Object {
    $parts = $_.FullName.Substring($root.Length + 1) -split '[\\/]'
    -not ($parts | Where-Object { $excludeDirs -contains $_ })
  }
}

$files = foreach ($rel in $include) { Get-PackFiles $rel }
$files = $files | Where-Object { -not (& $excludeFile $_.Name) } | Sort-Object FullName -Unique

$outPath = if ([System.IO.Path]::IsPathRooted($OutFile)) { $OutFile } else { Join-Path $root $OutFile }
New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
if (Test-Path $outPath) { Remove-Item -LiteralPath $outPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($outPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $files) {
    $entry = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $zip.Dispose()
}

$sizeMb = [math]::Round((Get-Item $outPath).Length / 1MB, 2)
Write-Host "Created $outPath ($($files.Count) files, $sizeMb MB)"
Write-Host 'Upload it in Dokploy: Application -> General -> Source: Drop, Build type: Dockerfile. See DEPLOY.md.'

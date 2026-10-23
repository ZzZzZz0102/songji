$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$vendor = Join-Path $project 'public\vendor'
New-Item -ItemType Directory -Path $vendor -Force | Out-Null
$assets = @(
  @{ Url='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; Name='qrcode.js' },
  @{ Url='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/README.md'; Name='qrcode-README.md' },
  @{ Url='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js'; Name='three.module.js' },
  @{ Url='https://cdn.jsdelivr.net/npm/three@0.160.1/LICENSE'; Name='three-LICENSE.txt' },
  @{ Url='https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js'; Name='gaussian-splats-3d.module.js' },
  @{ Url='https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/LICENSE'; Name='gaussian-LICENSE.txt' },
  @{ Url='https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js'; Name='model-viewer.min.js' },
  @{ Url='https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/LICENSE'; Name='model-viewer-LICENSE.txt' }
)
foreach ($asset in $assets) {
  Invoke-WebRequest -Uri $asset.Url -OutFile (Join-Path $vendor $asset.Name)
  Write-Output $asset.Name
}
Get-ChildItem $vendor -File | Get-FileHash -Algorithm SHA256 | Select-Object Hash,Path

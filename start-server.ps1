$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$env:HOST = "0.0.0.0"
$env:PORT = "3000"

$candidates = @()
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $candidates += $nodeCommand.Source
}

$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (Test-Path $bundledNode) {
  $candidates += $bundledNode
}

$uniqueCandidates = $candidates | Select-Object -Unique
foreach ($nodePath in $uniqueCandidates) {
  try {
    & $nodePath --version | Out-Null
    & $nodePath server.js
    exit $LASTEXITCODE
  } catch {
  }
}

Write-Host "未找到可用的 Node.js。请安装 Node.js 后运行 node server.js。"
exit 1

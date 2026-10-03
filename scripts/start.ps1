param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
function Assert-Exit { if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" } }
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    python -m venv .venv
    Assert-Exit
}
$projectPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not $SkipInstall) {
    & $projectPython -m pip install -r edge_backend/requirements.txt
    Assert-Exit
    npm ci --prefix frontend
    Assert-Exit
}
npm run build --prefix frontend
Assert-Exit
Write-Host 'ROVERA: http://127.0.0.1:8000 | API docs: http://127.0.0.1:8000/docs'
Write-Host 'SIMULATION ONLY. Press Ctrl+C to stop. ESC in the dashboard latches simulation E-STOP.'
& $projectPython -m uvicorn app.main:app --app-dir edge_backend --host 127.0.0.1 --port 8000 --no-proxy-headers

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d .venv ]; then python3 -m venv .venv; fi
if [ "${1:-}" != "--skip-install" ]; then
  .venv/bin/python -m pip install -r edge_backend/requirements.txt
  npm ci --prefix frontend
fi
npm run build --prefix frontend
echo 'ROVERA: http://127.0.0.1:8000 | API docs: http://127.0.0.1:8000/docs'
echo 'SIMULATION ONLY. Ctrl+C stops the server.'
exec .venv/bin/python -m uvicorn app.main:app --app-dir edge_backend --host 127.0.0.1 --port 8000 --no-proxy-headers

#!/usr/bin/env bash
# Sets up (if needed) and runs the backend + frontend dev servers together.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
    echo "Creando entorno virtual e instalando dependencias de Python..."
    python3 -m venv .venv
    .venv/bin/pip install -q -r requirements.txt
fi

if [ ! -d frontend/node_modules ]; then
    echo "Instalando dependencias del frontend..."
    (cd frontend && npm install)
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Aviso: ffmpeg no está instalado — la captura por voz no funcionará sin él." >&2
fi

# Fail fast if another instance (or anything else) already holds these ports.
# Without this check, a bind failure below still lets cleanup's `fuser -k`
# fire on EXIT -- which kills whatever's on the port, including a perfectly
# healthy unrelated server, not just this run's own children.
for port in 8000 5173; do
    if fuser "$port"/tcp >/dev/null 2>&1; then
        echo "El puerto $port ya está en uso -- ¿hay otra instancia corriendo? Detenla primero." >&2
        exit 1
    fi
done

cleanup() {
    echo "Deteniendo servidores..."
    # `npm run dev` spawns vite as a grandchild (via an intermediate `sh -c`),
    # which survives killing the tracked job PIDs directly. Killing by the
    # port each server actually binds is robust regardless of that process
    # tree shape.
    fuser -k 8000/tcp 5173/tcp 2>/dev/null || true
}
trap cleanup EXIT INT TERM

.venv/bin/uvicorn api:app --port 8000 &
(cd frontend && npm run dev) &

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "(Ctrl+C para detener ambos)"

wait

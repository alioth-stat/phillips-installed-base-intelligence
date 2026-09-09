# Inteligencia de Base Instalada de Clientes — Reto Philips

Prototipo para el reto de Philips en el **Decentralized AI Hackathon** (ISD Summit,
Panamá). Convierte lo que un colaborador de campo observa en un hospital (voz o
texto) en datos estructurados sobre los equipos instalados, con toda la
inferencia corriendo **on-device vía QVAC** — sin llamadas a APIs en la nube.

## Cómo funciona

1. **Captura**: el usuario escribe o graba una observación en lenguaje natural.
2. **Transcripción** (si es voz): Whisper on-device vía QVAC.
3. **Extracción**: un modelo pequeño (Qwen3-1.7B-Instruct) cargado vía QVAC extrae
   cliente, ciudad, país, modalidad, marca, modelo, cantidad y antigüedad,
   usando salida estructurada (JSON Schema forzado a nivel de decodificación).
4. **Confirmación**: los campos que el modelo no pudo inferir quedan vacíos en un
   formulario editable — así se resuelve el "preguntar por lo que falta" sin
   necesidad de un motor de diálogo.
5. **Deduplicación**: `rapidfuzz` compara la nueva observación contra las
   existentes (cliente + ciudad + modalidad + marca); si hay coincidencia fuerte,
   se suma como corroboración en vez de crear un registro nuevo.
6. **Confianza**: `0.7 × completitud + 0.3 × corroboración`, mapeado a
   Confirmado / Reportado / Estimado / Desconocido.
7. **Panel**: vista por cliente y vista agregada (modalidad × marca) entre
   todos los clientes.

## Requisito técnico cumplido

Toda la inferencia (transcripción + extracción) corre localmente a través del
SDK de QVAC (`tetherto.qvac_sdk`), sin ninguna llamada a una API en la nube.

## Interfaz

La interfaz principal es una app React (asistente en 5 pasos: Login → Modo →
Captura → Revisión → Panel, con panel de vidrio y transiciones deslizantes) que
habla con un backend FastAPI delgado. La app Streamlit original (`app.py`)
se mantiene en el repo como respaldo funcional — no se tocó.

## Instalación

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd frontend && npm install
```

`ffmpeg` debe estar instalado en el sistema (usado para transcodificar el
audio del navegador a WAV antes de pasarlo a QVAC).

La primera ejecución de QVAC puede tardar unos minutos: descarga el worker de
QVAC y los pesos de los modelos (Qwen3-1.7B-Instruct + Whisper) una sola vez.
Si el worker no se encuentra automáticamente, ejecuta:

```bash
.venv/bin/python -m tetherto.qvac_sdk install-worker
```

## Ejecutar

**Interfaz React (principal)** — dos procesos, backend y frontend:

```bash
.venv/bin/uvicorn api:app --port 8000 --reload    # terminal 1
cd frontend && npm run dev                        # terminal 2
```

Abrir `http://localhost:5173` (el dev server de Vite redirige `/api/*` al
backend en el puerto 8000).

**Interfaz Streamlit (respaldo)**:

```bash
.venv/bin/streamlit run app.py
```

## Tests

```bash
.venv/bin/python -m pytest -q
```

Los tests (`test_db.py`, `test_dedupe.py`, `test_confidence.py`, `test_extract.py`)
no requieren cargar ningún modelo — validan la lógica pura (schema, normalización,
scoring, dedup) de forma rápida y offline.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `api.py` | Backend FastAPI — envuelve los módulos de abajo, sin lógica propia |
| `frontend/` | UI React (Vite + TypeScript + Tailwind + shadcn/ui) |
| `app.py` | UI Streamlit de respaldo (Captura + Panel) |
| `qvac_client.py` | Conexión y carga de modelos vía QVAC SDK |
| `extract.py` | Schema JSON, prompt de extracción, normalización |
| `dedupe.py` | Detección de duplicados (rapidfuzz) |
| `confidence.py` | Cálculo de score de confianza y estado |
| `db.py` | Almacenamiento SQLite (observaciones + taxonomía) |
| `taxonomy.csv` | Modalidades y marcas de equipos (subconjunto tipo GMDN) |

## Guión de demo (para el video)

1. Mostrar la pestaña Captura vacía.
2. Escribir/grabar el ejemplo del reto: *"Estoy en Hospital DemoCare Pacific,
   en Panamá. Tienen dos resonadores y un tomógrafo. Uno de los resonadores
   parece de unos ocho años."*
3. Extraer → mostrar el formulario pre-llenado, completar el campo que falte,
   guardar.
4. Repetir con una observación similar (mismo hospital, ligera variación en el
   texto) → mostrar que se detecta como duplicado/corroboración.
5. Ir a Panel → mostrar la vista por cliente y la vista agregada.
6. Mencionar explícitamente que todo corrió on-device (sin conexión) vía QVAC.

## Fuera de alcance para el MVP (deliberado)

- **Captura por foto (VLM)**: identificar equipo desde una foto de la placa
  usando `VisionPsy-Nano` — quedó fuera del MVP a propósito para asegurar
  primero el flujo texto/voz de punta a punta; es la siguiente extensión
  natural una vez el MVP esté validado, reutilizando el mismo pipeline de
  extracción (la foto solo cambiaría la fuente de texto de entrada).
- Motor de diálogo multi-turno para preguntas de seguimiento — un formulario
  editable con los campos faltantes ya cumple ese requisito sin la
  complejidad de un gestor de conversación.

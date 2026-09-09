# Inteligencia de Base Instalada de Clientes — Reto Philips

Prototipo para el reto de Philips en el **Decentralized AI Hackathon** (ISD Summit,
Panamá). Convierte lo que un colaborador de campo observa en un hospital (voz o
texto) en datos estructurados sobre los equipos instalados, con toda la
inferencia corriendo **on-device vía QVAC** — sin llamadas a APIs en la nube.

## Cómo funciona

1. **Captura**: el usuario escribe, graba o **fotografía** una observación.
   - Texto: se usa directamente.
   - Voz: Whisper on-device vía QVAC transcribe el audio a texto.
   - Foto: VisionPsy-Nano (VLM) lee la placa/etiqueta del equipo y genera una
     descripción; esa descripción entra al mismo pipeline de extracción que el
     texto/voz — la foto solo cambia la fuente del texto de entrada.
2. **Extracción**: un modelo pequeño (Qwen3-1.7B-Instruct) cargado vía QVAC extrae
   cliente, ciudad, país, modalidad, marca, modelo, cantidad y antigüedad,
   usando salida estructurada (JSON Schema forzado a nivel de decodificación).
3. **Confirmación**: los campos que el modelo no pudo inferir quedan vacíos en un
   formulario editable — así se resuelve el "preguntar por lo que falta" sin
   necesidad de un motor de diálogo.
4. **Deduplicación**: `rapidfuzz` compara la nueva observación contra las
   existentes (cliente + ciudad + modalidad + marca); si hay coincidencia fuerte,
   se suma como corroboración en vez de crear un registro nuevo.
5. **Confianza**: `0.7 × completitud + 0.3 × corroboración`, mapeado a
   Confirmado / Reportado / Estimado / Desconocido.
6. **Panel**: vista por cliente y vista agregada (modalidad × marca) entre
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

**Un solo comando** (crea el venv e instala dependencias si hace falta,
levanta backend y frontend juntos, Ctrl+C detiene ambos):

```bash
./run.sh
```

**Manual**, si prefieres controlarlo por separado:

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
| `context/` | Reglas del hackathon, research de QVAC, y notas técnicas verificadas de la integración — ver [`context/README.md`](context/README.md) si vas a atacar otro reto reutilizando esta base |

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

## Fuera de alcance (deliberado)

- Motor de diálogo multi-turno para preguntas de seguimiento — un formulario
  editable con los campos faltantes ya cumple ese requisito sin la
  complejidad de un gestor de conversación.
- **Nota sobre la captura por foto**: VisionPsy-Nano es un modelo muy pequeño
  (460M parámetros) y a veces es inconsistente — en pruebas, a veces confirma
  su propia lectura y a veces la niega en la misma respuesta aunque el texto
  sea legible. Cuando falla, el formulario de revisión queda vacío igual que
  con texto/voz, y el usuario completa a mano.

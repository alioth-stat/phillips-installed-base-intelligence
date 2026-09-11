# Inteligencia de Base Instalada de Clientes

🇬🇧 [Read in English](README.md) &nbsp;·&nbsp; 🇪🇸 Español

**Propuesta para el reto de Philips en el Decentralized AI Hackathon, ISD Summit Panamá (sept. 2026)**

![Inferencia on-device](https://img.shields.io/badge/inferencia-100%25%20on--device-1e3a5f)
![QVAC SDK](https://img.shields.io/badge/impulsado%20por-QVAC%20SDK-2563eb)
![Tests](https://img.shields.io/badge/tests-16%20pasando-16a34a)
![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%2019-38bdf8)
[![Licencia](https://img.shields.io/badge/licencia-Apache%202.0-blue.svg)](LICENSE)

Un colaborador de campo visita un hospital, describe el equipo que observa, y
esta app convierte eso en datos estructurados de base instalada (cliente,
ciudad, modalidad, marca, modelo, cantidad, antigüedad) sin llenar un
formulario a mano. Cada paso de inferencia corre localmente a través del
[SDK de QVAC](https://qvac.tether.io) en la misma máquina donde corre la
app. Ninguna solicitud llega jamás a un LLM en la nube.

📹 **Video demo:** _agregar el enlace aquí antes de enviar_

<p align="center">
  <img src="docs/screenshots/01-login.jpg" width="32%" alt="Pantalla de login">
  <img src="docs/screenshots/04-review.jpg" width="32%" alt="Pantalla de revisión con campos extraídos">
  <img src="docs/screenshots/05-panel.jpg" width="32%" alt="Vista de panel agregado">
</p>

## El problema

Los colaboradores de campo que auditan el parque de equipos de un hospital
llenan estos datos a mano, después de la visita, de memoria o de notas. Un
hospital es exactamente el tipo de lugar para el que está pensado un modelo
on-device de QVAC: Wi-Fi intermitente, sin autorización para instalar
software no aprobado que se conecte hacia afuera, y un colaborador con un
teléfono en el bolsillo, no una laptop. Una llamada a una API en la nube es
mala idea aquí incluso antes de contar la regla del hackathon en contra.

## El requisito técnico, atendido directamente

> La inferencia debe correr on-device o peer-to-peer vía QVAC. Enrutar la
> inferencia a una API en la nube descalifica la entrega sin importar la
> calidad del resto del trabajo.

Esta app nunca llama a un LLM en la nube. `qvac_client.py` es el único lugar
que habla con QVAC, conecta una sola vez por proceso y carga los modelos de
forma perezosa en el primer uso. Cada modelo listado abajo pasa por ese
mismo camino. El backend FastAPI que sirve la interfaz es la única parte del
stack expuesta a la red, y sirve archivos estáticos y llamadas locales a la
API, nada más.

Fuimos más allá de una demo de escritorio:
[`context/termux-android-demo.md`](context/termux-android-demo.md) documenta
cómo correr este mismo stack, sin modificar, dentro de Termux en un teléfono
Android, de modo que el modelo realmente se ejecuta en la CPU ARM del
teléfono en vez de quedarse como una afirmación teórica. `install.sh` deja
listos ambos caminos con un solo comando (ver [Cómo correrlo](#cómo-correrlo)
más abajo).

Esta propuesta no reutiliza ninguna base preexistente ni plantilla inicial.
Todo lo que hay en este repositorio se escribió durante la ventana del
hackathon.

## Cómo funciona

```mermaid
flowchart LR
    A[Captura] -->|texto / voz / foto| B[Extracción]
    B -->|JSON estructurado, campos pueden ser null| C[Confirmación]
    C -->|formulario editable| D[Deduplicación]
    D -->|coincidencia difusa vs. registros existentes| E[Puntaje de confianza]
    E --> F[Panel]
```

1. **Captura.** Texto, voz, o una foto de la placa del equipo.
2. **Extracción.** Un modelo pequeño lee el texto (o la descripción de la
   foto) y devuelve campos estructurados como JSON forzado por gramática a
   nivel de decodificación, así que la salida siempre es válida contra el
   schema, nunca texto libre que haya que interpretar. Una narración puede
   listar varios tipos de equipo ("2 monitores, 1 resonador y un
   desfibrilador"); cada uno se vuelve un ítem, y una observación propia.
3. **Confirmación.** Lo que el modelo no pudo inferir vuelve como `null` y
   queda como un campo vacío en un formulario editable. Es deliberado: un
   motor de diálogo multi-turno para preguntas de seguimiento agregaría
   complejidad real para algo que un formulario editable ya resuelve.
4. **Deduplicación.** `rapidfuzz` compara la nueva observación contra los
   registros existentes (cliente + ciudad + modalidad + marca) y, si hay
   coincidencia fuerte, la suma como corroboración en vez de crear un
   registro nuevo.
5. **Confianza.** `0.7 × completitud + 0.3 × corroboración`, mapeado a
   Confirmado / Reportado / Estimado / Desconocido.
6. **Panel.** Vista por cliente y vista agregada (modalidad × marca) entre
   todos los clientes.

<p align="center">
  <img src="docs/screenshots/02-mode.jpg" width="19%" alt="Elegir captura por texto, voz o foto">
  <img src="docs/screenshots/03-capture.jpg" width="19%" alt="Escribiendo una observación">
  <img src="docs/screenshots/04-review.jpg" width="19%" alt="Formulario editable con campos extraídos">
  <img src="docs/screenshots/05-panel.jpg" width="19%" alt="Panel por cliente con estado de confianza">
  <img src="docs/screenshots/01-login.jpg" width="19%" alt="Pantalla de login">
</p>

<sub>Salida real de una corrida en vivo: una extracción real de QVAC sobre
la observación escrita en la captura de pantalla de arriba.</sub>

## Modelos

Nombrados y cuantizados con honestidad, tal como los carga `qvac_client.py`:

| Paso | Modelo | Cuantización | Parámetros | Respaldo |
|---|---|---|---|---|
| Extracción | Qwen3-1.7B-Instruct | Q4 | 1.7B | Llama-3.2-1B-Instruct (Q4_0) si el principal falla al cargar |
| Transcripción | Whisper small | Q8_0 | ~240M | n/a |
| Foto a texto | VisionPsy-Nano-460M (multimodal) | Q4_K_M, mmproj Q8_0 | 460M | n/a |

VisionPsy es uno de los modelos pequeños "Psy" dedicados de QVAC, construido
justo para este tipo de despliegue en el borde. Es genuinamente inconsistente
leyendo texto impreso pequeño en etiquetas de equipos: a veces confirma su
propia lectura y la contradice en la misma respuesta. Decidimos no agregar
heurísticas de confianza encima de las conjeturas de un modelo de 460M de
parámetros. Cuando falla, el formulario de revisión vuelve vacío, igual que
pasaría con una entrada de voz poco clara, y el colaborador lo completa a
mano. Disfrazar eso con una falsa confianza sería peor que un campo vacío y
honesto, especialmente para una propuesta que esta no está inscribiendo
formalmente pero que demuestra con claridad el espíritu de esa categoría:
inteligencia de dominio útil a partir de modelos muy pequeños en hardware
modesto, la misma premisa detrás del track dedicado de QVAC Psy en el
hackathon.

## Notas de ingeniería que vale la pena revisar

- **Extracción forzada por gramática.** El JSON Schema de los campos de
  extracción se aplica a nivel de decodificación (`extract.py`), no se
  valida después. El modelo no puede producir JSON inválido.
- **Un solo loop de asyncio durante toda la vida del proceso.** El
  transporte RPC de QVAC queda atado al event loop que lo creó.
  `qvac_client.py` mantiene un solo loop vivo para todo el proceso y
  serializa las llamadas con un lock, así que dos solicitudes simultáneas
  nunca compiten por él. Documentado en
  [`context/qvac-integration-notes.md`](context/qvac-integration-notes.md)
  junto con los demás bugs de integración que encontramos y arreglamos, no
  que supusimos.
- **Pensada para pantallas de teléfono desde el inicio.** Cada contenedor
  de paso usa `dvh` en vez de `vh`, porque la barra de direcciones de un
  navegador móvil y el teclado en pantalla rompen el `100vh` ingenuo. Los
  objetivos táctiles están en el mínimo de ~44px, y los márgenes de
  safe-area mantienen el contenido lejos de notches y barras de gestos.
- **Un fondo con dither y un panel de vidrio translúcido.** El fondo es un
  dither ordenado (Bayer) renderizado como un tile SVG de 8×8, un guiño al
  patrón de escaneo de medio tono de los monitores de diagnóstico de
  Philips. Se desplaza en sincronía con cada transición de paso, mientras
  el panel de trabajo encima usa un `backdrop-blur-2xl` real para que el
  material se lea como vidrio.
- **Un instalador de un solo comando para ambos destinos.** `install.sh`
  detecta Termux automáticamente e instala el conjunto de dependencias
  correcto tanto para un escritorio normal como para un teléfono, incluidos
  los dos arreglos específicos de Termux que encontramos en un dispositivo
  real (sin `/tmp` con permisos de escritura en la ruta estándar,
  `pydantic-core` necesitando el propio toolchain de Rust de Termux porque
  no tiene wheel prebuilt para `aarch64-linux-android`).

## Cómo correrlo

**Un comando, cualquiera de los dos destinos** (detecta Termux vs.
escritorio automáticamente):

```bash
curl -fsSL https://raw.githubusercontent.com/alioth-stat/phillips-installed-base-intelligence/master/install.sh | bash
```

En un escritorio esto clona el repo y levanta ambos servidores. Pegado en
Termux en un teléfono Android, instala el camino on-device en su lugar; ver
[`context/termux-android-demo.md`](context/termux-android-demo.md) para
entender qué demuestra eso y por qué envolver la app web no demostraría lo
mismo.

**Instalación manual:**

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd frontend && npm install
```

`ffmpeg` debe estar instalado en el sistema (se usa para transcodificar el
audio de `MediaRecorder` del navegador a WAV antes de pasarlo a QVAC). La
primera llamada a QVAC descarga el worker y los pesos de los modelos una
sola vez. Si no se encuentra automáticamente:

```bash
.venv/bin/python -m tetherto.qvac_sdk install-worker
```

**Luego, un solo comando para ambos servidores** (Ctrl+C detiene los dos):

```bash
./run.sh
```

Abrir `http://localhost:5173`. El dev server de Vite redirige `/api/*` al
backend de FastAPI en el puerto 8000.

Existe una interfaz de respaldo en Streamlit en `app.py`
(`.venv/bin/streamlit run app.py`), que se mantiene funcional pero no es
donde va el trabajo nuevo de frontend.

## Tests

```bash
.venv/bin/python -m pytest -q
```

16 tests, lógica pura (normalización de schema, coincidencia de dedup,
puntaje de confianza, round-trips de base de datos), sin cargar ningún
modelo, rápido y offline.

## Estructura del proyecto

| Archivo | Responsabilidad |
|---|---|
| `api.py` | Backend FastAPI, envuelve los módulos de abajo, sin lógica propia |
| `qvac_client.py` | El único lugar que habla con el SDK de QVAC |
| `extract.py` | JSON Schema, prompt de extracción, normalización de la salida |
| `dedupe.py` | Detección difusa de duplicados (`rapidfuzz`) |
| `confidence.py` | Puntaje y estado de confianza |
| `db.py` | Almacenamiento en SQLite (observaciones + taxonomía), sin ORM |
| `taxonomy.csv` | 20 modalidades de equipo, 20 marcas de fabricantes |
| `frontend/` | React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui |
| `app.py` | Interfaz de respaldo en Streamlit, funcional, sin desarrollo activo |
| `install.sh` | Instalador de un comando, escritorio y Termux/Android |
| `context/` | Reglas del hackathon, research de QVAC, y notas de integración verificadas contra corridas reales, ver [`context/README.md`](context/README.md) |

## Fuera de alcance, deliberadamente

- **Motor de diálogo multi-turno para preguntas de seguimiento.** Un
  formulario editable con los campos que el modelo no pudo inferir resuelve
  el mismo problema sin un gestor de conversación.
- **Heurísticas de confianza para las lecturas fotográficas de VisionPsy.**
  Cubierto arriba, en Modelos.

## Nota sobre el idioma

La interfaz del producto y los prompts de extracción están en español. Es
deliberado: los colaboradores de campo para quienes se construyó esta app
trabajan en Panamá y hablan español, y el ejemplo del propio reto está
escrito en español. Este documento está en español para el equipo y
cualquier jurado que lo prefiera; la versión en inglés vive en
[`README.md`](README.md).

## Licencia

[Apache License 2.0](LICENSE). Elegida sobre MIT por la concesión explícita
de patentes: protege tanto a este proyecto como a quien construya sobre él,
algo que importa más en código adyacente a modelos de IA que en una app web
típica. El track general no exige licencia abierta; el track de QVAC Psy sí,
y esto lo satisface.

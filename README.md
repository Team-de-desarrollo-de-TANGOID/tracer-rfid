# Racket Club — Trazabilidad de activos

**Prototipo DEMO** para presentación al cliente.

> Desarrollado e implementado por **TANGOID SRL**.

## Funcionalidades (demo)

- **Inventario y búsqueda** — filtros por estado, KPIs, alta/baja de activos
- **Alta de activo** — asociación EPC ↔ SKU (lectura R3 **simulada**)
- **Auditoría rápida** — conteo masivo simulado (canasto)
- **Sincronización** — envío simulado de lista autorizada al FX9600 (puerta)
- **Configuración** — catálogo SKU y estados editables (SQLite)

## Requisitos

- Node.js 20+
- Windows 10/11 (objetivo del producto final)

## Ejecutar en modo demo

```bash
npm install
npm run dev
```

Antes de iniciar, `predev` libera los puertos **3847** (API) y **5173** (Vite) si quedaron ocupados por una ejecución anterior. Si falla igual, ejecute:

```bash
npm run ports:free
npm run dev
```

Esto inicia:

1. API local en `http://localhost:3847` (SQLite en `data/racket-club.db`)
2. Interfaz Vite en `http://localhost:5173`
3. Ventana Electron con la aplicación

También puede abrir solo el navegador en `http://localhost:5173` si la API ya está corriendo (`npm run server` en otra terminal).

## Estructura

```
├── electron/          # Shell escritorio
├── server/            # API Express + SQLite
├── src/               # React (UI basada en maquetado rfid-soft)
└── docs/              # SDKs y documentación de hardware
```

## Demo portable (sin instalación)

Para generar un ejecutable que el cliente puede copiar en un USB **sin instalar Node ni npm**:

```bash
npm install
```

**Windows (recomendado):** doble clic o desde terminal:

```bat
scripts\build-portable.bat
```

Ese script compila desde `C:\racketclub-build` (enlace sin espacios en la ruta), porque `electron-builder` no soporta carpetas con espacios.

Alternativa manual:

```bash
npm run pack:portable
```

(solo si el proyecto está en una ruta **sin espacios**, ej. `C:\racketclub`)

Salida en `release-demo/` (o `release-demo-XXXX` si la carpeta estaba en uso):

| Archivo | Uso |
|---------|-----|
| `RacketClub-Trazabilidad-demo-portable.exe` | Un solo `.exe` portable (doble clic) |
| `win-unpacked/` | Misma app en carpeta (útil si el .exe único falla) |
| `LEEME.txt` | Instrucciones para el cliente |

> **Importante:** cierre la app antes de volver a compilar. Si la ventana se cierra sola, revise `data/racket-club.log` junto al ejecutable.

**Carpeta ZIP (alternativa):** útil si el antivirus bloquea el `.exe` único:

```bat
scripts\build-portable.bat
```

Luego comprima `release\win-unpacked\` en un ZIP. El cliente ejecuta el `.exe` dentro; los datos quedan en `data/` al lado del programa.

> Ya existe `release\RacketClub-Trazabilidad-demo-portable.exe` si compiló correctamente.

> La primera compilación descarga Electron (~150 MB) y puede tardar varios minutos.

## Fase final (con hardware)

| Componente | Integración planificada |
|------------|-------------------------|
| Lector USB R3 | Servicio C# con `UHFAPI.dll` (ver `docs/`) |
| FX9600 puerta | REST ZIoTC + User App Python (`pyziotc`) |
| Baliza roja | GPIO `/cloud/gpo` desde User App |

Documentación FX9600: https://zebradevs.github.io/rfid-ziotc-docs/

## Créditos

**TANGOID SRL** — desarrollo e implementación de este software.

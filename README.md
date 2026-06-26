# RFID TRACER — Trazabilidad y gestión de activos con RFID

**Prototipo DEMO** para presentación y validación con el cliente.

> Desarrollado e implementado por **TANGOID SRL**.

Aplicación híbrida (escritorio Electron + API local) para inventario, auditoría y trazabilidad de activos etiquetados con RFID. En esta fase los lectores **R3** (USB) y **FX9600** (puerta) están **simulados**; la base de datos es **SQLite** local.

## Acceso demo

| Campo      | Valor        |
|-----------|--------------|
| Usuario   | `admin`      |
| Contraseña | `Admin3915` |

Cambie estas credenciales antes de cualquier uso fuera de un entorno de prueba controlado.

## Funcionalidades (demo)

### Inventario
- Listado con búsqueda rápida y **filtros del sistema** (TID, estado, ubicación, fechas)
- **Filtros personalizados** por propiedades configurables del activo
- **KPIs dinámicos** — un contador por cada estado definido en configuración
- **Columnas configurables** (máx. 7 visibles), orden por columna
- Edición rápida inline, detalle de activo, historial de eventos
- Acciones por lote: cambio de estado, ubicación, baja/eliminación

### Alta de activos
- Modo individual o por lote (múltiples TID)
- Formulario **dinámico** según el catálogo de propiedades (sistema + personalizadas)
- Lectura R3 **simulada**

### Auditoría rápida
- Lectura masiva simulada (canasto de etiquetas)
- Tabla en **solo lectura** con acción **Ir a registro** (salta al inventario y resalta el activo)
- **Guardar auditoría** con usuario, fechas, totales y detalle por TID
- **Historial** de auditorías guardadas, consultable en cualquier momento

### Sincronización
- Envío simulado de lista autorizada al lector FX9600 (puerta)
- Historial de sincronizaciones

### Configuración
- Catálogo **SKU**, **estados** (habilitado/deshabilitado), **ubicaciones**
- **Propiedades de activos** personalizables (texto, número, fecha)
- Columnas visibles del inventario (por usuario con permiso)

### Usuarios y roles
- Gestión de usuarios y roles con **permisos granulares** por módulo

## Requisitos

- Node.js 20+
- Windows 10/11 (objetivo del producto final; el modo web también corre en otros SO con Node)

## Desarrollo

```bash
npm install
```

### Escritorio (Electron + API + Vite)

```bash
npm run dev
```

Inicia:

1. API en `http://localhost:3847` (SQLite en `data/racket-club.db`)
2. Interfaz Vite en `http://localhost:5173`
3. Ventana Electron

### Solo navegador (API + Vite, sin Electron)

```bash
npm run dev:web
```

Abra `http://localhost:5173` en el navegador.

### Si los puertos están ocupados

`predev` y `predev:web` ejecutan `ports:free` automáticamente. Si aún falla:

```bash
npm run ports:free
npm run dev
```

## Modo producción local (un solo puerto)

Útil para compartir la demo en la red local o detrás de un túnel (Cloudflare, ngrok):

```bash
npm run build
```

**Windows (PowerShell):**

```powershell
$env:SERVE_UI="1"; node server/index.js
```

**Windows (cmd) / Linux / macOS:**

```bash
set SERVE_UI=1 && node server/index.js
# o
SERVE_UI=1 node server/index.js
```

La app queda en `http://localhost:3847` (API + frontend en el mismo origen).

### Compartir temporalmente con un gerente/cliente

1. Levante el modo producción local (arriba) o `npm run dev:web` en su PC.
2. Exponga el puerto con un túnel, por ejemplo:
   - `npx cloudflared tunnel --url http://localhost:3847`
   - o `ngrok http 3847`
3. Comparta la URL HTTPS que genera el túnel.

> En plan gratuito la URL suele cambiar en cada sesión. Para algo de varios días, considere Render, Railway o un VPS pequeño.

## Estructura del proyecto

```
├── electron/          # Shell de escritorio
├── server/            # API Express + SQLite + migraciones
├── src/               # React + Vite + Tailwind
├── public/            # Assets estáticos (logo.svg)
├── data/              # Base SQLite (se crea al iniciar)
├── scripts/           # Build portable para Windows
└── docs/              # SDKs y documentación de hardware
```

## Demo portable (sin instalar Node)

Para generar un ejecutable que se puede copiar en un USB:

```bat
scripts\build-portable.bat
```

Ese script compila desde `C:\racketclub-build` (ruta sin espacios), porque `electron-builder` falla con carpetas que contienen espacios en la ruta.

Alternativa manual (solo si el proyecto está en ruta **sin espacios**):

```bash
npm run pack:portable
```

Salida en `release/`:

| Artefacto | Descripción |
|-----------|-------------|
| `RacketClub-Trazabilidad-demo-portable.exe` | Ejecutable portable |
| `win-unpacked/` | Misma app en carpeta |
| `LEEME.txt` | Instrucciones para el usuario final |

> Cierre la app antes de recompilar. Si la ventana se cierra sola, revise `data/racket-club.log` junto al ejecutable.

## API principal

| Ruta | Descripción |
|------|-------------|
| `GET /api/health` | Estado del servidor |
| `POST /api/auth/login` | Inicio de sesión |
| `/api/activos` | Inventario y CRUD de activos |
| `/api/auditorias` | Guardar y consultar historial de auditorías |
| `/api/propiedades-activo` | Catálogo de propiedades personalizables |
| `/api/mock/*` | Lectores RFID simulados |
| `/api/sync` | Sincronización con puerta (demo) |

## Fase final (con hardware real)

| Componente | Integración planificada |
|------------|-------------------------|
| Lector USB R3 | Servicio C# con `UHFAPI.dll` (ver `docs/`) |
| FX9600 puerta | REST ZIoTC + User App Python (`pyziotc`) |
| Baliza roja | GPIO `/cloud/gpo` desde User App |

Documentación FX9600: https://zebradevs.github.io/rfid-ziotc-docs/

## Créditos

**TANGOID SRL** — desarrollo e implementación de este software.

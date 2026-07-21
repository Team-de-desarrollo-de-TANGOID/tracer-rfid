# Manual de la aplicación — RFID TRACER

**Racket Club — Trazabilidad y gestión de activos con RFID**  
Desarrollado e implementado por **TANGOID SRL**.

---

## 1. Descripción general

RFID TRACER es una aplicación híbrida (escritorio Electron y/o navegador web) con API local en Node.js y base de datos SQLite. Permite:

- Gestionar el inventario de activos etiquetados (toallas, indumentaria, etc.).
- Controlar qué activos **no pueden salir** del club mediante un lector **Zebra FX9600** en el portal de entrada/salida.
- Recibir **alertas en tiempo real** cuando se detecta una salida no autorizada.
- Consultar métricas en el **dashboard** (KPIs y detecciones).

### Arquitectura

```
┌─────────────────────┐     HTTPS/REST      ┌──────────────────────┐
│  PC — RFID TRACER   │ ◄──────────────────►│  Zebra FX9600        │
│  API :3847          │     webhook alert   │  User App :8765      │
│  React UI           │                     │  racketclub-gate     │
└─────────────────────┘                     └──────────────────────┘
         │                                              │
         │ SQLite                                       │ RFID / GPIO
         ▼                                              ▼
   data/racket-club.db                          Portal + antenas
```

---

## 2. Módulos de la interfaz

| Sección | Ruta | Descripción |
|---------|------|-------------|
| **Dashboard** | `/` | KPIs de activos y salidas no autorizadas por período |
| **Activos → Inventario** | `/activos/inventario` | Listado, filtros, edición, bajas |
| **Activos → Agregar** | `/activos/agregar` | Alta individual o por lote (TID/EPC) |
| **Sincronizar** | `/sincronizar` | Envío de lista al lector FX9600 |
| **Configuración → Propiedades** | `/configuracion/catalogos` | SKU, estados, ubicaciones, propiedades |
| **Configuración → Lector de puerta** | `/configuracion/lector-puerta` | Conexión FX9600, monitor, ajustes de lectura |
| **Configuración → Usuarios y roles** | `/configuracion/usuarios-roles` | Usuarios, roles y permisos |

El menú lateral solo muestra las secciones permitidas por el rol del usuario.

---

## 3. Inventario de activos

### Campos principales

- **TID / EPC:** identificador RFID de la etiqueta (clave para el lector).
- **SKU, estado, ubicación:** catálogos configurables.
- **Propiedades personalizadas:** definidas en Configuración.
- **Permite salida:** si está en **No**, el TID entra en la lista de control del portal (no puede salir sin alerta).

### Filtros y columnas

- Búsqueda rápida y filtros por estado, ubicación, fechas.
- Filtros por propiedades personalizadas.
- Hasta 7 columnas visibles configurables por usuario con permiso.

### Acciones por lote

- Cambio de estado o ubicación.
- Eliminación / baja de activos.

---

## 4. Portal de entrada/salida (FX9600)

### Lógica de negocio

La lista sincronizada al lector contiene activos **activos** con **`permite_salida = 0`** (no pueden salir).

| Situación | Comportamiento |
|-----------|----------------|
| TID **en la lista** (toalla que no debería salir) | Lectura **denegada** → alerta a la app + GPO (baliza) si está habilitado |
| TID **fuera de la lista** | Lectura **autorizada** (puede salir) |
| TID no registrado en inventario | Alerta igualmente; en el modal se indica “no registrada” |

### Flujo de alertas en la app

1. El lector detecta un TID denegado y envía `POST /api/portal/alert` a la PC.
2. El servidor consulta `/api/tag-events` en la User App del lector.
3. Los clientes web conectados reciben la alerta por **SSE** (`/api/dashboard/alerts/stream`).
4. Se muestra un **modal** de salida no autorizada.

### Comportamiento del modal de alerta

- Muestra la cantidad de **toallas distintas** detectadas (un TID = una toalla).
- Las lecturas posteriores **acumulan** nuevas etiquetas sin cerrar el modal.
- Las etiquetas que **dejan de reportarse** (salen del campo de lectura) se **eliminan automáticamente** del listado tras el tiempo configurado en *Segundos entre lectura/alerta del mismo tag* (`seenTimeout`, típicamente 5 s + margen).
- El modal **solo lo cierra el usuario** (botón Aceptar o X).
- El detalle por etiqueta (TID, SKU, estado) está en un **desplegable** oculto por defecto.

### Contador histórico (dashboard)

- Cada TID cuenta **una sola vez cada 2 horas** en el total de “Salidas no autorizadas”.
- Evita inflar el número por re-lecturas de la misma toalla.

---

## 5. Sincronización con el lector

1. Configure la conexión en **Configuración → Lector de puerta → Monitor → Conexión**.
2. Vaya a **Sincronizar**.
3. La app envía a la User App (`POST /api/sync`):
   - Lista de TIDs con `permite_salida = 0`
   - Versión de lista
   - Token API
   - Pin GPO para baliza

Tras sincronizar, el lector aplica la lista localmente (`racketclub_allowlist.json`).

---

## 6. Configuración del lector de puerta

Ruta: **Configuración → Lector de puerta**

### Estado → Resumen

- IP, versión de User App, PID, cantidad de TIDs en lista.
- Acciones: **Iniciar app** / **Detener app** (requiere contraseña SSH `rfidadm`).

### Monitor → Conexión

- Emparejamiento con el lector (IP, credenciales admin y SSH).
- Configura webhook de alertas hacia la PC automáticamente.

### Monitor → Logs

- Stream en vivo del log `/tmp/racketclub-gate.log` del lector.

### Operación

| Subsección | Parámetros |
|------------|------------|
| **Lectura y alertas** | `seenTimeout` (dedupe entre alertas del mismo tag), popup en pantalla |
| **Baliza GPO** | Habilitar GPO, pin 1–4, duración en segundos |
| **Antenas** | Habilitación y potencia por antena |
| **Avanzado** | Sesión RF (S0/S1), reintentos TID, entorno de lectura |

---

## 7. Dashboard

- **Total activos / Activas / Otras:** según estados configurados.
- **Salidas no autorizadas:** toallas distintas detectadas en el período (máx. 1 por etiqueta cada 2 h).
- **Detecciones no autorizadas:** tabla con últimas detecciones.
- Filtros de período: hoy, ayer, semana, mes, mes anterior.

Requiere permiso `dashboard.ver` para ver alertas y dashboard.

---

## 8. Usuarios, roles y permisos

Los permisos son granulares por módulo (`inventario.ver`, `activos.crear`, `sync.ejecutar`, `dashboard.ver`, `config.*`, `usuarios.gestionar`, etc.).

El usuario `admin` por defecto tiene acceso completo. Gestione usuarios adicionales en **Configuración → Usuarios y roles**.

---

## 9. User App `racketclub-gate` (hardware)

Paquete Debian instalado en el FX9600 vía **Applications** en la consola Zebra.

### Compilar el .deb

```bash
# Git Bash / Linux
bash hardware/fx9600/build-deb.sh

# Windows (sin dpkg-deb)
python hardware/fx9600/build-deb.py
```

Genera `hardware/fx9600/racketclub-gate_<versión>_all.deb`.

### API en el lector (puerto 8765)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado de la app |
| GET | `/api/status` | PID, versión, TIDs en lista |
| POST | `/api/sync` | Sincronizar lista desde la PC |
| GET | `/api/tag-events?since=` | Eventos de tags |
| GET | `/api/logs/stream` | Log en vivo (SSE) |

Header de autenticación: `X-RacketClub-Token`.

Documentación ampliada: [hardware/fx9600/README.md](../hardware/fx9600/README.md).

---

## 10. API de la aplicación (PC)

| Ruta | Descripción |
|------|-------------|
| `GET /api/health` | Estado del servidor |
| `POST /api/auth/login` | Login JWT |
| `GET /api/dashboard` | KPIs y detecciones |
| `GET /api/dashboard/alerts/stream` | SSE alertas portal |
| `POST /api/portal/alert` | Webhook del FX9600 |
| `/api/activos` | CRUD inventario |
| `/api/sync` | Sincronización lector |

Puerto por defecto: **3847** (`API_PORT`).

---

## 11. Estructura del proyecto

```
├── docs/                 # Documentación (este manual, acceso, credenciales)
├── electron/             # Shell escritorio
├── server/               # API Express + SQLite + migraciones
├── src/                  # React + Vite + Tailwind
├── hardware/fx9600/      # User App Python + scripts + .deb
├── data/                 # Base SQLite (se crea al iniciar)
└── scripts/              # Utilidades (puertos, build portable)
```

---

## 12. Comandos útiles

```bash
npm run dev          # Electron + API + Vite
npm run dev:web      # API + Vite (navegador)
npm run build        # Compilar frontend
npm run ports:free   # Liberar puertos 3847 y 5173
npm run test:fx9600  # Probar conectividad con lector
```

### Detener User App desde la PC

```powershell
$env:FX9600_IP = "169.254.240.149"
$env:FX9600_PASSWORD = "Admin1234$"
node hardware/fx9600/scripts/stop-gate-app.js
```

---

## 13. Documentación relacionada

- [ACCESO-PANELES.md](./ACCESO-PANELES.md) — Cómo ingresar a cada panel web
- [CREDENCIALES.md](./CREDENCIALES.md) — Usuarios y contraseñas
- [hardware/fx9600/README.md](../hardware/fx9600/README.md) — User App y troubleshooting
- Documentación oficial Zebra: https://zebradevs.github.io/rfid-ziotc-docs/

---

**TANGOID SRL** — soporte e implementación.

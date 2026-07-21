# FX9600 User App — racketclub-gate

Basado en `FX9600/gec-IoT-TagDetection-master-base`. **No hay que tocar IoT Connector ni cloud en la consola web.**

> Credenciales del lector y acceso al panel Zebra: [docs/CREDENCIALES.md](../../docs/CREDENCIALES.md) y [docs/ACCESO-PANELES.md](../../docs/ACCESO-PANELES.md).

## Cómo funciona (igual que el proyecto base)

```
┌─────────────────────────────────────────┐
│  FX9600                                  │
│                                          │
│  User App (DA)  ──pyziotc──►  tags JSON │
│       │                                  │
│       └──HTTP 127.0.0.1:80──► /cloud/*  │  ← API local del lector (NO es "la nube")
│            start / stop / mode / config  │
└─────────────────────────────────────────┘
```

- **`pyziotc`**: el runtime DA de Zebra entrega cada tag a `MSG_IN_JSON`.
- **`/cloud/start` en localhost**: arranca el inventario (mismo código que Tag-Detection).
- **No** se configuran endpoints HTTP/MQTT/LLRP en la consola.
- **No** hay API hacia la PC en esta fase.

Log: `/tmp/racketclub-gate.log`

## Instalar

```bash
bash hardware/fx9600/build-deb.sh
```

En Windows (Git Bash) sin `dpkg-deb`, el script usa Python automáticamente:

```bash
python hardware/fx9600/build-deb.py
```

Genera `hardware/fx9600/racketclub-gate_1.0.1-fase1_all.deb`.

Consola Zebra → Applications → `racketclub-gate_1.0.3-fase1_all.deb` → Start

**AutoStart:** dejalo desactivado mientras probás. Si está activo, al hacer Stop la consola la vuelve a arrancar sola (verde).

### Detener la app

**Por qué a veces no responde Stop en Zebra:** suele haber **AutoStart** activo (reinicia sola) y/o una **copia huérfana** iniciada por SSH (`nohup`) que la consola Zebra no controla.

1. **Desde Racket Club (recomendado):** Configuración → Lector de puerta → Estado → Resumen  
   - Ingrese **contraseña SSH (rfidadm)** → **Detener app**  
   - Crea `/apps/.racketclub-gate-stopped`, apaga AutoStart, mata procesos y libera el puerto 8765.
2. En Applications de Zebra: **desmarcar AutoStart** → **Stop**
3. Por SSH: `/apps/stop_racketclub-gate.sh`
4. Desde la PC:

```powershell
$env:FX9600_IP = "169.254.240.149"
$env:FX9600_PASSWORD = "tu_password"
node hardware/fx9600/scripts/stop-gate-app.js
```

## Probar

```bash
ssh rfidadm@<ip-lector>
tail -f /tmp/racketclub-gate.log
```

## Roadmap

1. **Fase 1** — log de TID
2. **Fase 2** — API REST :8765, lista local, alertas portal, sync web app, token API (**actual**)
3. Monitor PC (web app integrado)
4. Baliza GPO en producción (`AlertViaGpo=True` en `config.ini`)

## API User App (puerto 8765)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | No | Probe de vida |
| GET | `/api/status` | Token | PID, versión, count lista |
| GET | `/api/allowlist` | Token | TIDs en el lector |
| POST | `/api/sync` | Bootstrap* | `{ tids, version, gpoPin, apiToken }` |
| GET | `/api/logs?offset=&maxBytes=` | Token | Fragmento del log (legacy) |
| GET | `/api/logs/stream?tail=` | Token | **Stream SSE tail -f en vivo** |
| GET | `/api/tag-events?since=` | Token | Eventos estructurados |
| POST | `/api/shutdown` | Token | Detiene la User App de forma ordenada |
| POST | `/api/credentials` | Bootstrap* | Credenciales admin + token |

\* Si no hay token configurado, el primer `POST /api/sync` con `apiToken` lo establece.

Header: `X-RacketClub-Token: <token>` (la web app lo envía automáticamente tras sync).

## Lógica del portal

La lista sincronizada contiene activos **activos** que **no pueden salir** (`permite_salida=0`).

- TID **en la lista** → `LECTURA denegada` + alerta (GPO simulado en logs por defecto)
- TID **fuera de la lista** → `LECTURA autorizada`

Para activar baliza física en producción: `AlertViaGpo=True` en `[API]` de `config.ini`.

## Error: `LLRP is configured as data endpoint` (422)

Si el log muestra:

```
Inventory Start Failed :422 -> RC request cannot be processed when LLRP is configured as data endpoint
```

**No es un bug de la app.** El **Tag Data Interface** del IoT Connector no puede quedar vacío ni en LLRP. Si no hay un endpoint HTTP/MQTT en **Data**, el firmware trata LLRP como data endpoint y bloquea `/cloud/start`, `/cloud/stop` y `/cloud/mode`.

La User App sigue recibiendo tags por **pyziotc**; el HTTP-POST en Data es solo para satisfacer al IoT Connector (un sink local basta).

### Arreglo (una vez por lector)

**Opción A — consola web**

1. `http://<ip-lector>` → **Communication → Zebra IoT Connector → Configuration**
2. **Add Endpoint** → tipo **HTTP POST** (URL dummy `127.0.0.1:1` vale)
3. **Tag Data Interface** → ese endpoint HTTP (no LLRP, no vacío)
4. **Control** y **Management** → marcar **Local REST**
5. **Connection** → **Connect**
6. Applications → **Stop** + **Start** en `racketclub-gate`

**Opción B — script desde la PC** (contraseña admin del lector):

Bash / Git Bash:

```bash
cd "Racket Club"
FX9600_IP=169.254.240.149 FX9600_PASSWORD=tu_password node hardware/fx9600/scripts/reset-rc-api-mapping.js
```

PowerShell (Windows):

```powershell
cd "C:\Users\Administrator\Desktop\Proyectos RFID\Racket Club"
$env:FX9600_IP = "169.254.240.149"
$env:FX9600_PASSWORD = "tu_password"
node hardware/fx9600/scripts/reset-rc-api-mapping.js
```

Luego reiniciar la User App en la consola.

### Verificar

Tras el arreglo, el log debe mostrar `Inventory Started` y lecturas `LECTURA TID=...` al pasar tags.

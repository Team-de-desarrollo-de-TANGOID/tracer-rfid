# FX9600 User App — Fase 1 (igual que Tag-Detection GEC)

Basado en `FX9600/gec-IoT-TagDetection-master-base`. **No hay que tocar IoT Connector ni cloud en la consola web.**

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

1. En Applications: **desmarcar AutoStart** → **Stop**
2. O desde la PC:

```powershell
$env:FX9600_IP = "169.254.240.149"
$env:FX9600_PASSWORD = "tu_password"
node hardware/fx9600/scripts/stop-gate-app.js
```

3. O por SSH: `/apps/stop_racketclub-gate.sh`

## Probar

```bash
ssh rfidadm@<ip-lector>
tail -f /tmp/racketclub-gate.log
```

## Roadmap

1. **Fase 1** — log de TID (actual)
2. Allow-list local
3. API sync PC
4. Monitor PC

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

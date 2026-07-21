# Acceso a los paneles web — paso a paso

Esta guía explica cómo ingresar al **panel de la aplicación Racket Club** y al **panel web del lector FX9600**.

Credenciales detalladas: [CREDENCIALES.md](./CREDENCIALES.md).

---

## 1. Panel web de RFID TRACER (Racket Club)

### Requisitos

- Node.js 20+ instalado (solo para modo desarrollo).
- O el ejecutable portable / build de producción (sin Node).

### Opción A — Desarrollo (recomendado para técnicos)

1. Abra una terminal en la carpeta del proyecto.
2. Instale dependencias (solo la primera vez):
   ```bash
   npm install
   ```
3. Inicie la aplicación:
   ```bash
   npm run dev:web
   ```
   Esto levanta la API en el puerto **3847** y la interfaz en **5173**.
4. Abra el navegador en:
   ```
   http://localhost:5173
   ```
5. En la pantalla de inicio de sesión ingrese:
   - **Usuario:** `admin`
   - **Contraseña:** `Admin3915`
6. Pulse **Iniciar sesión**.

### Opción B — Producción local (un solo puerto)

1. Compile la interfaz:
   ```bash
   npm run build
   ```
2. Inicie el servidor con la UI integrada:

   **Windows (PowerShell):**
   ```powershell
   $env:SERVE_UI="1"; node server/index.js
   ```

   **Linux / macOS / Git Bash:**
   ```bash
   SERVE_UI=1 node server/index.js
   ```

3. Abra el navegador en:
   ```
   http://localhost:3847
   ```
4. Inicie sesión con `admin` / `Admin3915`.

### Opción C — Ejecutable portable (Windows)

1. Ejecute `RacketClub-Trazabilidad-demo-portable.exe` (ver `demo-portable/LEEME.txt`).
2. Se abrirá la ventana de la aplicación; use las mismas credenciales `admin` / `Admin3915`.

### Acceso desde otra PC en la red

1. Levante la app en modo producción (`SERVE_UI=1`) en la PC servidor.
2. Obtenga la IP local de esa PC (ej. `192.168.1.50`).
3. Desde otra máquina en la misma red abra:
   ```
   http://192.168.1.50:3847
   ```
4. Asegúrese de que el firewall de Windows permita el puerto **3847**.

---

## 2. Panel web del lector Zebra FX9600

### Requisitos de red

- La PC debe alcanzar la IP del lector.
- IP por defecto en instalación link-local: **`169.254.240.149`**.
- Conexión típica: cable Ethernet directo PC ↔ lector, o misma subred.

### Paso a paso

1. **Conecte** la PC al lector (Ethernet recomendado para la primera configuración).

2. **Compruebe conectividad** (opcional):
   ```bash
   ping 169.254.240.149
   ```

3. Abra un navegador (Chrome o Edge recomendados) y vaya a:
   ```
   https://169.254.240.149
   ```
   Si no responde, pruebe también `http://169.254.240.149`.

4. **Certificado HTTPS:** el lector usa un certificado autofirmado.
   - Chrome/Edge: *Advanced* → *Proceed to 169.254.240.149 (unsafe)*  
   - O el equivalente en español: *Avanzado* → *Continuar al sitio*

5. En la pantalla **User Login** de Zebra:
   - **User Name:** seleccione o escriba `admin`
   - **Password:** `Admin1234$`
   - Pulse **Login** / **Iniciar sesión**

6. Tras el login verá la **Reader Administration Console** (consola de administración).

### Secciones útiles del panel FX9600

| Menú | Para qué sirve |
|------|----------------|
| **Applications** | Instalar, Start/Stop y AutoStart de `racketclub-gate` (.deb) |
| **Communication → Zebra IoT Connector** | Configuración de endpoints (arreglo error LLRP 422) |
| **GPIO** | Probar salidas GPO (baliza) |
| **Read Tags** | Inventario de prueba desde la consola |
| **System Log** | Logs del sistema del lector |

### Instalar la User App desde el panel

1. **Applications** → subir el archivo `.deb` (ej. `racketclub-gate_1.0.16-fase2_all.deb`).
2. Desmarque **AutoStart** mientras prueba.
3. Pulse **Start** en la aplicación instalada.
4. Verifique el log por SSH: `tail -f /tmp/racketclub-gate.log`

Documentación técnica de la User App: [hardware/fx9600/README.md](../hardware/fx9600/README.md).

---

## 3. Vincular el lector con la app Racket Club

Una vez que ambos paneles son accesibles:

1. Inicie sesión en **RFID TRACER** (`http://localhost:5173` o `:3847`).
2. Vaya a **Configuración → Lector de puerta**.
3. En **Monitor → Conexión**:
   - IP del lector: `169.254.240.149`
   - Usuario admin del lector: `admin`
   - Contraseña admin: `Admin1234$`
   - Usuario SSH: `rfidadm`
   - Contraseña SSH: `Tangodeveloper3915$`
4. Pulse **Conectar** / **Buscar lector**.
5. La app configurará automáticamente webhook de alertas, token API y URL hacia la PC.

6. Vaya a **Sincronizar** y ejecute la sincronización de la lista de TIDs autorizados hacia el lector.

---

## 4. Solución de problemas de acceso

| Problema | Qué revisar |
|----------|-------------|
| No abre `localhost:5173` | ¿Corre `npm run dev:web`? Ejecute `npm run ports:free` y reintente. |
| No abre `https://169.254.240.149` | Cable, IP del lector, firewall. Pruebe `ping`. |
| Login FX9600 rechazado con `admin` | Use contraseña `Admin1234$` exacta (mayúsculas y símbolos). |
| API REST del lector falla con `admin` | Use `rfidadm` / `Tangodeveloper3915$` para Local REST (la app lo hace sola). |
| Alertas no llegan al popup | Verifique conexión en Configuración → Lector de puerta y que la User App esté **Start**. |
| Error LLRP 422 en log | Ver [hardware/fx9600/README.md](../hardware/fx9600/README.md) sección LLRP. |

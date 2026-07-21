# Credenciales del sistema

> **Importante:** Estas credenciales son para el entorno de instalación actual. Cámbielas antes de exponer la red a terceros o a Internet.

---

## Aplicación RFID TRACER (Racket Club)

Acceso al panel web de gestión de inventario, dashboard y configuración.

| Campo | Valor |
|-------|-------|
| URL (desarrollo) | `http://localhost:5173` |
| URL (producción local) | `http://localhost:3847` |
| Usuario | `admin` |
| Contraseña | `Admin3915` |

La contraseña por defecto se define en `server/constants/permissions.js` (`ADMIN_DEFAULT_PASSWORD`). Puede cambiarse desde **Configuración → Usuarios y roles** (si tiene permisos).

---

## Lector Zebra FX9600 — panel web (consola Zebra)

Acceso a la interfaz web del lector: Applications, IoT Connector, GPIO, firmware, etc.

| Campo | Valor |
|-------|-------|
| URL | `https://169.254.240.149` (o la IP configurada del lector) |
| Usuario | `admin` |
| Contraseña | `Admin1234$` |

El navegador puede mostrar advertencia de certificado autofirmado: continúe de forma segura (Advanced → Proceed).

---

## Lector Zebra FX9600 — usuario `rfidadm`

Usado para **SSH**, **API Local REST** (`/cloud/localRestLogin`) y operaciones que la app Racket Club realiza contra el lector (sync, monitor, start/stop de la User App).

| Campo | Valor |
|-------|-------|
| Usuario SSH | `rfidadm` |
| Contraseña | `Tangodeveloper3915$` |
| IP por defecto | `169.254.240.149` |

**Nota:** La API REST local del FX9600 acepta login con `rfidadm` (no con `admin`). La app guarda estas credenciales en la base de datos al conectar el lector desde **Configuración → Lector de puerta**.

### SSH (terminal)

```bash
ssh rfidadm@169.254.240.149
```

---

## Resumen rápido

| Sistema | Usuario | Contraseña | Uso |
|---------|---------|------------|-----|
| App Racket Club | `admin` | `Admin3915` | Panel de inventario y portal |
| FX9600 panel web | `admin` | `Admin1234$` | Consola Zebra (Applications, etc.) |
| FX9600 SSH / API | `rfidadm` | `Tangodeveloper3915$` | SSH, sync, monitor, control User App |

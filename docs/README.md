# Documentación — RFID TRACER (Racket Club)

**Desarrollado e implementado por TANGOID SRL.**

Índice de la documentación del proyecto:

| Documento | Contenido |
|-----------|-----------|
| [MANUAL-APLICACION.md](./MANUAL-APLICACION.md) | Manual completo: módulos, flujos, portal, dashboard, sincronización |
| [ACCESO-PANELES.md](./ACCESO-PANELES.md) | Paso a paso para ingresar al panel web de la app y al panel del lector FX9600 |
| [CREDENCIALES.md](./CREDENCIALES.md) | Usuarios y contraseñas (app, lector, SSH) |
| [../hardware/fx9600/README.md](../hardware/fx9600/README.md) | User App `racketclub-gate`: instalación, API, troubleshooting |

## Inicio rápido

```bash
npm install
npm run dev          # Escritorio (Electron + API + Vite)
# o
npm run dev:web      # Solo navegador
```

- **App web:** [http://localhost:5173](http://localhost:5173) (desarrollo) o [http://localhost:3847](http://localhost:3847) (producción con `SERVE_UI=1`)
- **Lector FX9600 (panel Zebra):** [https://169.254.240.149](https://169.254.240.149) (IP por defecto; puede variar)

> Antes de usar en producción, revise y cambie las contraseñas documentadas en [CREDENCIALES.md](./CREDENCIALES.md).

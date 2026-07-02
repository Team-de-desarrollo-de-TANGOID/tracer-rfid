import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb } from './db.js';

import authRoutes from './routes/auth.js';
import activosRoutes from './routes/activos.js';
import estadosRoutes from './routes/estados.js';
import skusRoutes from './routes/skus.js';
import ubicacionesRoutes from './routes/ubicaciones.js';
import usuariosRoutes from './routes/usuarios.js';
import rolesRoutes from './routes/roles.js';
import preferenciasRoutes from './routes/preferencias.js';
import propiedadesActivosRoutes from './routes/propiedadesActivos.js';
import mockRoutes from './routes/mock.js';
import syncRoutes from './routes/sync.js';
import auditoriasRoutes from './routes/auditorias.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT) || 3847;
const SERVE_UI = process.env.SERVE_UI === '1' || process.env.SERVE_UI === 'true';

initDb();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const demo = getDb().prepare("SELECT value FROM config WHERE key = 'demo_mode'").get();
  res.json({
    ok: true,
    app: 'RFID TRACER — Trazabilidad y gestión de activos con RFID',
    vendor: 'TANGOID SRL',
    demo: demo?.value === 'true',
    version: '0.2.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/activos', activosRoutes);
app.use('/api/estados', estadosRoutes);
app.use('/api/skus', skusRoutes);
app.use('/api/ubicaciones', ubicacionesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/preferencias', preferenciasRoutes);
app.use('/api/propiedades-activo', propiedadesActivosRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/auditorias', auditoriasRoutes);
app.use('/api/sync', syncRoutes);
app.get('/api/config', (_req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM config').all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

if (SERVE_UI) {
  const distPath =
    process.env.RC_DIST_DIR || path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        console.error('[Racket Club] No se encontró la UI en:', distPath, err.message);
        res.status(500).send('Error al cargar la interfaz. Revise data/racket-club.log');
      }
    });
  });
}

const server = app.listen(PORT, () => {
  const mode = SERVE_UI ? 'app' : 'api';
  console.log(`[Racket Club] http://localhost:${PORT} (${mode} — TANGOID SRL)`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[Racket Club API] Puerto ${PORT} en uso. Cierre la instancia anterior o ejecute:\n  npm run ports:free\n`
    );
    process.exit(1);
  }
  throw err;
});

process.on('unhandledRejection', (reason) => {
  console.error('[Racket Club API] unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Racket Club API] uncaughtException:', err);
});

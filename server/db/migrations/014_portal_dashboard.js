import { ADMIN_ROLE_NAME } from '../../constants/permissions.js';

const NEW_PERMISSIONS = [
  { codigo: 'dashboard.ver', nombre: 'Ver dashboard y alertas de puerta', modulo: 'dashboard' },
];

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS portal_detecciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tid TEXT NOT NULL COLLATE NOCASE,
      activo_id INTEGER,
      tipo TEXT NOT NULL DEFAULT 'SALIDA_DENEGADA',
      antena INTEGER,
      rssi REAL,
      evento_lector_id INTEGER,
      detectado_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (activo_id) REFERENCES activos(id)
    );
    CREATE INDEX IF NOT EXISTS idx_portal_detecciones_detectado ON portal_detecciones(detectado_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_detecciones_evento
      ON portal_detecciones(evento_lector_id) WHERE evento_lector_id IS NOT NULL;
  `);

  db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('portal_last_event_id', '0')").run();

  const insertPerm = db.prepare(
    'INSERT OR IGNORE INTO permisos (codigo, nombre, modulo) VALUES (?, ?, ?)'
  );
  for (const p of NEW_PERMISSIONS) {
    insertPerm.run(p.codigo, p.nombre, p.modulo);
  }

  const link = db.prepare(
    'INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)'
  );
  const dashboardPerm = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get('dashboard.ver');

  if (dashboardPerm) {
    const adminRol = db.prepare('SELECT id FROM roles WHERE nombre = ?').get(ADMIN_ROLE_NAME);
    if (adminRol) link.run(adminRol.id, dashboardPerm.id);

    const rolesWithAudit = db
      .prepare(
        `SELECT DISTINCT rp.rol_id
         FROM rol_permisos rp
         JOIN permisos p ON p.id = rp.permiso_id
         WHERE p.codigo IN ('auditoria.ejecutar', 'auditoria.ver_historial', 'inventario.ver', 'sync.ejecutar', 'sync.ver_historial')`
      )
      .all();
    for (const row of rolesWithAudit) {
      link.run(row.rol_id, dashboardPerm.id);
    }
  }
}

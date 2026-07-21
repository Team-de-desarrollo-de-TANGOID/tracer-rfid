export function up(db) {
  const dashboardPerm = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get('dashboard.ver');
  if (!dashboardPerm) return;

  const link = db.prepare(
    'INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)'
  );

  const roles = db
    .prepare(
      `SELECT DISTINCT rp.rol_id
       FROM rol_permisos rp
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo IN (
         'inventario.ver', 'sync.ejecutar', 'sync.ver_historial',
         'auditoria.ejecutar', 'auditoria.ver_historial'
       )`
    )
    .all();

  for (const row of roles) {
    link.run(row.rol_id, dashboardPerm.id);
  }
}

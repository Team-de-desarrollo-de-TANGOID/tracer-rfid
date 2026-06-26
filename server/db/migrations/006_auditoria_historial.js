import { ADMIN_ROLE_NAME } from '../../constants/permissions.js';

const NEW_PERMISSION = {
  codigo: 'auditoria.ver_historial',
  nombre: 'Ver historial de auditorías',
  modulo: 'auditoria',
};

export function up(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auditorias_fecha_fin ON auditorias(fecha_fin);
    CREATE INDEX IF NOT EXISTS idx_auditoria_detalle_auditoria ON auditoria_detalle(auditoria_id);
  `);

  db.prepare(
    'INSERT OR IGNORE INTO permisos (codigo, nombre, modulo) VALUES (?, ?, ?)'
  ).run(NEW_PERMISSION.codigo, NEW_PERMISSION.nombre, NEW_PERMISSION.modulo);

  const adminRol = db.prepare('SELECT id FROM roles WHERE nombre = ?').get(ADMIN_ROLE_NAME);
  if (adminRol) {
    const perm = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get(NEW_PERMISSION.codigo);
    if (perm) {
      db.prepare(
        'INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)'
      ).run(adminRol.id, perm.id);
    }
  }

  // Roles con ejecutar auditoría también pueden ver historial
  const ejecutar = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get('auditoria.ejecutar');
  const verHist = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get(NEW_PERMISSION.codigo);
  if (ejecutar && verHist) {
    const roles = db
      .prepare('SELECT rol_id FROM rol_permisos WHERE permiso_id = ?')
      .all(ejecutar.id);
    const link = db.prepare(
      'INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)'
    );
    for (const r of roles) {
      link.run(r.rol_id, verHist.id);
    }
  }
}

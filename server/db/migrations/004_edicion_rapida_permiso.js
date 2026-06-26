import { ADMIN_ROLE_NAME } from '../../constants/permissions.js';

const NEW_PERMISSIONS = [
  { codigo: 'activos.edicion_rapida', nombre: 'Edición rápida en tabla', modulo: 'activos' },
];

export function up(db) {
  const insertPerm = db.prepare(
    'INSERT OR IGNORE INTO permisos (codigo, nombre, modulo) VALUES (?, ?, ?)'
  );
  for (const p of NEW_PERMISSIONS) {
    insertPerm.run(p.codigo, p.nombre, p.modulo);
  }

  const adminRol = db.prepare('SELECT id FROM roles WHERE nombre = ?').get(ADMIN_ROLE_NAME);
  if (adminRol) {
    const link = db.prepare(
      'INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)'
    );
    for (const p of NEW_PERMISSIONS) {
      const row = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get(p.codigo);
      if (row) link.run(adminRol.id, row.id);
    }
  }
}

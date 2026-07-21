import { ADMIN_ROLE_NAME } from '../../constants/permissions.js';

const NEW_PERMISSIONS = [
  {
    codigo: 'dashboard.alertas',
    nombre: 'Recibir alertas de salida no autorizada',
    modulo: 'dashboard',
  },
  {
    codigo: 'dashboard.reiniciar_contador',
    nombre: 'Reiniciar contador de toallas detectadas',
    modulo: 'dashboard',
  },
  {
    codigo: 'sync.control_app',
    nombre: 'Iniciar y detener User App en el lector',
    modulo: 'sync',
  },
];

export function up(db) {
  const insertPerm = db.prepare(
    'INSERT OR IGNORE INTO permisos (codigo, nombre, modulo) VALUES (?, ?, ?)'
  );
  for (const p of NEW_PERMISSIONS) {
    insertPerm.run(p.codigo, p.nombre, p.modulo);
  }

  const adminRol = db.prepare('SELECT id FROM roles WHERE nombre = ?').get(ADMIN_ROLE_NAME);
  const link = db.prepare(
    'INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)'
  );

  if (adminRol) {
    for (const p of NEW_PERMISSIONS) {
      const row = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get(p.codigo);
      if (row) link.run(adminRol.id, row.id);
    }
  }

  // Quien ya tenía dashboard.ver recibe alertas; quien sincroniza controla la app.
  const dashboardVer = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get('dashboard.ver');
  const alertas = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get('dashboard.alertas');
  const syncEjecutar = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get('sync.ejecutar');
  const controlApp = db.prepare('SELECT id FROM permisos WHERE codigo = ?').get('sync.control_app');

  if (dashboardVer && alertas) {
    const roles = db
      .prepare('SELECT rol_id FROM rol_permisos WHERE permiso_id = ?')
      .all(dashboardVer.id);
    for (const { rol_id } of roles) {
      link.run(rol_id, alertas.id);
    }
  }

  if (syncEjecutar && controlApp) {
    const roles = db
      .prepare('SELECT rol_id FROM rol_permisos WHERE permiso_id = ?')
      .all(syncEjecutar.id);
    for (const { rol_id } of roles) {
      link.run(rol_id, controlApp.id);
    }
  }
}

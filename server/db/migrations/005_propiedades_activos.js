import { ADMIN_ROLE_NAME } from '../../constants/permissions.js';

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const SISTEMA_CODIGOS = ['epc', 'sku', 'estado', 'ubicacion', 'fecha_registro', 'fecha_baja'];

const CAMPO_ACTIVO_MAP = {
  descripcion: 'descripcion',
  codigo_interno: 'codigo_interno',
  motivo_baja: 'motivo_baja',
};

const NEW_PERMISSION = {
  codigo: 'config.propiedades',
  nombre: 'Gestionar propiedades de activos',
  modulo: 'configuracion',
};

export function up(db) {
  addColumnIfMissing(db, 'columnas_tabla', 'es_sistema', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'columnas_tabla', 'oculta', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'columnas_tabla', 'tipo', "TEXT NOT NULL DEFAULT 'texto'");
  addColumnIfMissing(db, 'columnas_tabla', 'campo_activo', 'TEXT');
  addColumnIfMissing(db, 'activos', 'propiedades_extra', "TEXT NOT NULL DEFAULT '{}'");

  for (const codigo of SISTEMA_CODIGOS) {
    db.prepare('UPDATE columnas_tabla SET es_sistema = 1 WHERE codigo = ?').run(codigo);
  }

  for (const [codigo, campo] of Object.entries(CAMPO_ACTIVO_MAP)) {
    db.prepare('UPDATE columnas_tabla SET campo_activo = ? WHERE codigo = ?').run(campo, codigo);
  }

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
}

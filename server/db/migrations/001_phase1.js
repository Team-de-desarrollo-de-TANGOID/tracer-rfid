import bcrypt from 'bcryptjs';
import {
  PERMISSIONS,
  INVENTORY_COLUMNS,
  ADMIN_ROLE_NAME,
  ADMIN_USERNAME,
  ADMIN_DEFAULT_PASSWORD,
} from '../../constants/permissions.js';

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS estados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      nombre TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#64748b',
      es_activo INTEGER NOT NULL DEFAULT 1,
      permite_salida INTEGER NOT NULL DEFAULT 0,
      orden INTEGER NOT NULL DEFAULT 0,
      es_sistema INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS skus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ubicaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL DEFAULT 'general',
      activo INTEGER NOT NULL DEFAULT 1,
      orden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epc TEXT NOT NULL UNIQUE COLLATE NOCASE,
      sku_id INTEGER NOT NULL,
      estado_id INTEGER NOT NULL,
      ubicacion_id INTEGER,
      ubicacion TEXT DEFAULT '',
      descripcion TEXT DEFAULT '',
      codigo_interno TEXT DEFAULT '',
      fecha_registro TEXT NOT NULL,
      fecha_baja TEXT,
      motivo_baja TEXT DEFAULT '',
      updated_at TEXT,
      FOREIGN KEY (sku_id) REFERENCES skus(id),
      FOREIGN KEY (estado_id) REFERENCES estados(id),
      FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      total_enviados INTEGER NOT NULL DEFAULT 0,
      exito INTEGER NOT NULL DEFAULT 1,
      mensaje TEXT NOT NULL DEFAULT '',
      duracion_ms INTEGER,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS permisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      modulo TEXT NOT NULL DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL DEFAULT '',
      es_sistema INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS rol_permisos (
      rol_id INTEGER NOT NULL,
      permiso_id INTEGER NOT NULL,
      PRIMARY KEY (rol_id, permiso_id),
      FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1,
      rol_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT,
      FOREIGN KEY (rol_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS columnas_tabla (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      etiqueta TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      visible_default INTEGER NOT NULL DEFAULT 1,
      editable INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usuario_preferencias (
      usuario_id INTEGER NOT NULL,
      clave TEXT NOT NULL,
      valor TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (usuario_id, clave),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eventos_activo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activo_id INTEGER,
      epc TEXT NOT NULL,
      tipo TEXT NOT NULL,
      estado_anterior_id INTEGER,
      estado_nuevo_id INTEGER,
      ubicacion_anterior TEXT,
      ubicacion_nueva TEXT,
      usuario_id INTEGER,
      origen TEXT NOT NULL DEFAULT 'manual',
      metadata TEXT DEFAULT '{}',
      notas TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE SET NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS auditorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT,
      total_leidos INTEGER NOT NULL DEFAULT 0,
      total_registrados INTEGER NOT NULL DEFAULT 0,
      total_desconocidos INTEGER NOT NULL DEFAULT 0,
      usuario_id INTEGER,
      notas TEXT DEFAULT '',
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS auditoria_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      epc TEXT NOT NULL,
      activo_id INTEGER,
      registrado INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE,
      FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_eventos_activo_id ON eventos_activo(activo_id);
    CREATE INDEX IF NOT EXISTS idx_eventos_epc ON eventos_activo(epc);
    CREATE INDEX IF NOT EXISTS idx_activos_estado ON activos(estado_id);
    CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);
  `);

  // Columnas nuevas en tablas existentes (upgrade desde demo)
  // SQLite no permite ADD COLUMN con UNIQUE — se agrega sin restricción.
  addColumnIfMissing(db, 'estados', 'codigo', 'TEXT');
  addColumnIfMissing(db, 'estados', 'permite_salida', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'estados', 'es_sistema', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'activos', 'ubicacion_id', 'INTEGER');
  addColumnIfMissing(db, 'activos', 'codigo_interno', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'activos', 'fecha_baja', 'TEXT');
  addColumnIfMissing(db, 'activos', 'motivo_baja', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'activos', 'updated_at', 'TEXT');
  addColumnIfMissing(db, 'sync_log', 'duracion_ms', 'INTEGER');
  addColumnIfMissing(db, 'sync_log', 'version', 'INTEGER DEFAULT 1');

  seedCatalogs(db);
  seedAuth(db);
  seedDemoDataIfEmpty(db);
}

function seedCatalogs(db) {
  const insertPerm = db.prepare(
    'INSERT OR IGNORE INTO permisos (codigo, nombre, modulo) VALUES (@codigo, @nombre, @modulo)'
  );
  for (const p of PERMISSIONS) insertPerm.run(p);

  const insertCol = db.prepare(`
    INSERT OR IGNORE INTO columnas_tabla (codigo, etiqueta, orden, visible_default, editable)
    VALUES (@codigo, @etiqueta, @orden, @visible_default, @editable)
  `);
  for (const c of INVENTORY_COLUMNS) insertCol.run(c);

  const ubicaciones = [
    { nombre: 'Almacén', tipo: 'almacen', orden: 1 },
    { nombre: 'Vestuario', tipo: 'vestuario', orden: 2 },
    { nombre: 'Cancha 1', tipo: 'cancha', orden: 3 },
    { nombre: 'Lavandería', tipo: 'lavanderia', orden: 4 },
  ];
  const insertUb = db.prepare(
    'INSERT OR IGNORE INTO ubicaciones (nombre, tipo, orden) VALUES (@nombre, @tipo, @orden)'
  );
  for (const u of ubicaciones) insertUb.run(u);
}

function seedAuth(db) {
  let adminRole = db.prepare('SELECT id FROM roles WHERE nombre = ?').get(ADMIN_ROLE_NAME);
  if (!adminRole) {
    const r = db
      .prepare('INSERT INTO roles (nombre, descripcion, es_sistema) VALUES (?, ?, 1)')
      .run(ADMIN_ROLE_NAME, 'Acceso total al sistema');
    adminRole = { id: r.lastInsertRowid };
  }

  const permIds = db.prepare('SELECT id FROM permisos').all();
  const link = db.prepare('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)');
  for (const p of permIds) link.run(adminRole.id, p.id);

  const existingAdmin = db
    .prepare('SELECT id FROM usuarios WHERE username = ? COLLATE NOCASE')
    .get(ADMIN_USERNAME);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(ADMIN_DEFAULT_PASSWORD, 10);
    db.prepare(
      `INSERT INTO usuarios (username, password_hash, nombre, rol_id)
       VALUES (?, ?, ?, ?)`
    ).run(ADMIN_USERNAME, hash, 'Administrador', adminRole.id);
  }
}

function seedDemoDataIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM activos').get().n;
  if (count > 0) {
    // Actualizar estados demo con codigo/permite_salida si faltan
    db.prepare(`UPDATE estados SET codigo = 'ACTIVA', permite_salida = 0 WHERE nombre = 'Activa' AND codigo IS NULL`).run();
    db.prepare(`UPDATE estados SET codigo = 'LAVANDERIA', permite_salida = 1 WHERE nombre = 'En lavandería' AND codigo IS NULL`).run();
    db.prepare(`UPDATE estados SET codigo = 'BAJA', permite_salida = 0, es_activo = 0, es_sistema = 1 WHERE nombre = 'Baja' AND codigo IS NULL`).run();
    db.prepare(`UPDATE estados SET es_sistema = 1 WHERE codigo = 'ACTIVA'`).run();
    return;
  }

  const estados = [
    { codigo: 'ACTIVA', nombre: 'Activa', color: '#16a34a', es_activo: 1, permite_salida: 0, orden: 1, es_sistema: 1 },
    { codigo: 'LAVANDERIA', nombre: 'En lavandería', color: '#2563eb', es_activo: 0, permite_salida: 1, orden: 2, es_sistema: 0 },
    { codigo: 'BAJA', nombre: 'Baja', color: '#64748b', es_activo: 0, permite_salida: 0, orden: 3, es_sistema: 1 },
  ];
  const insertEstado = db.prepare(
    `INSERT INTO estados (codigo, nombre, color, es_activo, permite_salida, orden, es_sistema)
     VALUES (@codigo, @nombre, @color, @es_activo, @permite_salida, @orden, @es_sistema)`
  );
  for (const e of estados) insertEstado.run(e);

  const skus = [
    { codigo: 'TOALLA-BASICA', descripcion: 'Toalla básica algodón' },
    { codigo: 'TOALLA-DEPORTIVA', descripcion: 'Toalla deportiva microfibra' },
    { codigo: 'TOALLA-SPA', descripcion: 'Toalla spa premium' },
  ];
  const insertSku = db.prepare(
    'INSERT INTO skus (codigo, descripcion) VALUES (@codigo, @descripcion)'
  );
  for (const s of skus) insertSku.run(s);

  const estadoActiva = db.prepare("SELECT id FROM estados WHERE codigo = 'ACTIVA'").get().id;
  const estadoBaja = db.prepare("SELECT id FROM estados WHERE codigo = 'BAJA'").get().id;
  const skuBasica = db.prepare("SELECT id FROM skus WHERE codigo = 'TOALLA-BASICA'").get().id;
  const skuDeportiva = db.prepare("SELECT id FROM skus WHERE codigo = 'TOALLA-DEPORTIVA'").get().id;
  const ubAlmacen = db.prepare("SELECT id FROM ubicaciones WHERE nombre = 'Almacén'").get()?.id;
  const ubVestuario = db.prepare("SELECT id FROM ubicaciones WHERE nombre = 'Vestuario'").get()?.id;
  const ubCancha = db.prepare("SELECT id FROM ubicaciones WHERE nombre = 'Cancha 1'").get()?.id;

  const demoTags = [
    { epc: 'E2007823941001', sku_id: skuBasica, estado_id: estadoActiva, ubicacion_id: ubAlmacen, ubicacion: 'Almacén', descripcion: 'Toalla básica #001' },
    { epc: 'E2007823941002', sku_id: skuBasica, estado_id: estadoActiva, ubicacion_id: ubVestuario, ubicacion: 'Vestuario', descripcion: 'Toalla básica #002' },
    { epc: 'E2007823941003', sku_id: skuDeportiva, estado_id: estadoActiva, ubicacion_id: ubCancha, ubicacion: 'Cancha 1', descripcion: 'Toalla deportiva #003' },
    { epc: 'E2007823941004', sku_id: skuDeportiva, estado_id: estadoBaja, ubicacion_id: null, ubicacion: '—', descripcion: 'Toalla dada de baja' },
  ];

  const insertActivo = db.prepare(`
    INSERT INTO activos (epc, sku_id, estado_id, ubicacion_id, ubicacion, descripcion, fecha_registro, updated_at)
    VALUES (@epc, @sku_id, @estado_id, @ubicacion_id, @ubicacion, @descripcion, datetime('now','localtime'), datetime('now','localtime'))
  `);
  for (const t of demoTags) insertActivo.run(t);

  db.prepare(`
    INSERT OR REPLACE INTO config (key, value) VALUES
      ('fx9600_ip', '192.168.1.100'),
      ('fx9600_user', 'admin'),
      ('demo_mode', 'true'),
      ('ultima_sync', ''),
      ('app_version', '0.2.0')
  `).run();
}

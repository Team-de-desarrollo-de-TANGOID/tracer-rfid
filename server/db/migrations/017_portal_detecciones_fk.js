/** FK portal_detecciones → activos con ON DELETE SET NULL al eliminar activos. */
export function up(db) {
  db.exec(`
    CREATE TABLE portal_detecciones_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tid TEXT NOT NULL COLLATE NOCASE,
      activo_id INTEGER,
      tipo TEXT NOT NULL DEFAULT 'SALIDA_DENEGADA',
      antena INTEGER,
      rssi REAL,
      evento_lector_id INTEGER,
      detectado_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE SET NULL
    );
    INSERT INTO portal_detecciones_new SELECT * FROM portal_detecciones;
    DROP TABLE portal_detecciones;
    ALTER TABLE portal_detecciones_new RENAME TO portal_detecciones;
    CREATE INDEX IF NOT EXISTS idx_portal_detecciones_detectado ON portal_detecciones(detectado_at);
    CREATE INDEX IF NOT EXISTS idx_portal_detecciones_evento ON portal_detecciones(evento_lector_id);
  `);
}

export function down(db) {
  db.exec(`
    CREATE TABLE portal_detecciones_old (
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
    INSERT INTO portal_detecciones_old SELECT * FROM portal_detecciones;
    DROP TABLE portal_detecciones;
    ALTER TABLE portal_detecciones_old RENAME TO portal_detecciones;
    CREATE INDEX IF NOT EXISTS idx_portal_detecciones_detectado ON portal_detecciones(detectado_at);
    CREATE INDEX IF NOT EXISTS idx_portal_detecciones_evento ON portal_detecciones(evento_lector_id);
  `);
}

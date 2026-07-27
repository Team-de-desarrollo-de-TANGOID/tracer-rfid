/**
 * Historial de cargas (altas por lote) desde Agregar activos.
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alta_lotes_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      usuario_id INTEGER,
      usuario_nombre TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      errores INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alta_lotes_historial_fecha
      ON alta_lotes_historial(fecha DESC);
  `);
}

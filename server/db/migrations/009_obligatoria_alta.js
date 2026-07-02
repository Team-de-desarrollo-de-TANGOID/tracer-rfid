function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function up(db) {
  addColumnIfMissing(db, 'columnas_tabla', 'obligatoria_alta', 'INTEGER NOT NULL DEFAULT 0');
  db.prepare(
    `UPDATE columnas_tabla SET obligatoria_alta = 1 WHERE codigo IN ('sku', 'estado')`
  ).run();
}

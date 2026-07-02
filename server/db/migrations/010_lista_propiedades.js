function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function up(db) {
  addColumnIfMissing(db, 'columnas_tabla', 'lista_opciones', "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(db, 'columnas_tabla', 'lista_multiple', 'INTEGER NOT NULL DEFAULT 0');
}

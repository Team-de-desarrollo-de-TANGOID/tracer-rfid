function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function up(db) {
  addColumnIfMissing(
    db,
    'columnas_tabla',
    'creado_por_usuario_id',
    'INTEGER REFERENCES usuarios(id) ON DELETE SET NULL'
  );
}

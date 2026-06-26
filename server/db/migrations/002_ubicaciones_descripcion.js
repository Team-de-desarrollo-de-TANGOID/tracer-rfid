function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function up(db) {
  addColumnIfMissing(db, 'ubicaciones', 'descripcion', "TEXT NOT NULL DEFAULT ''");

  const defaults = {
    Almacén: 'Depósito principal de toallas',
    Vestuario: 'Sector vestuarios de socios',
    'Cancha 1': 'Cancha de pádel principal',
    Lavandería: 'Salida autorizada hacia lavandería externa',
  };
  const update = db.prepare(
    'UPDATE ubicaciones SET descripcion = ? WHERE nombre = ? AND (descripcion IS NULL OR descripcion = \'\')'
  );
  for (const [nombre, descripcion] of Object.entries(defaults)) {
    update.run(descripcion, nombre);
  }
}

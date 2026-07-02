export function up(db) {
  db.prepare(`UPDATE columnas_tabla SET codigo = 'tid' WHERE codigo = 'epc'`).run();

  const rows = db
    .prepare(
      `SELECT usuario_id, valor FROM usuario_preferencias WHERE clave = 'inventario_columnas'`
    )
    .all();

  const update = db.prepare(
    `UPDATE usuario_preferencias SET valor = ? WHERE usuario_id = ? AND clave = 'inventario_columnas'`
  );

  for (const row of rows) {
    try {
      const saved = JSON.parse(row.valor);
      if (!Array.isArray(saved)) continue;
      const next = saved.map((c) => (c === 'epc' ? 'tid' : c));
      if (JSON.stringify(next) !== row.valor) {
        update.run(JSON.stringify(next), row.usuario_id);
      }
    } catch {
      /* ignore malformed prefs */
    }
  }
}

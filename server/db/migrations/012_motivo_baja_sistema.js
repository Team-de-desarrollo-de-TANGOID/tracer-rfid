export function up(db) {
  db.prepare(`UPDATE columnas_tabla SET es_sistema = 1 WHERE codigo = 'motivo_baja'`).run();
}

export function up(db) {
  db.prepare(
    `UPDATE columnas_tabla SET etiqueta = 'TID (RFID)' WHERE codigo = 'epc'`
  ).run();
}

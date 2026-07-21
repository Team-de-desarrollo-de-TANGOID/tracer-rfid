/** Permite reutilizar evento_lector_id tras reinicio de la User App en el FX9600. */
export function up(db) {
  db.exec('DROP INDEX IF EXISTS idx_portal_detecciones_evento');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_portal_detecciones_evento ON portal_detecciones(evento_lector_id)'
  );
}

export function down(db) {
  db.exec('DROP INDEX IF EXISTS idx_portal_detecciones_evento');
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_detecciones_evento
      ON portal_detecciones(evento_lector_id) WHERE evento_lector_id IS NOT NULL
  `);
}

/**
 * Detecciones guardadas con toISOString() (UTC) sin indicador de zona.
 * Convertir a hora de Buenos Aires (UTC-3).
 */
export function up(db) {
  db.exec(`
    UPDATE portal_detecciones
    SET detectado_at = datetime(detectado_at, '-3 hours')
    WHERE detectado_at IS NOT NULL AND trim(detectado_at) != '';
  `);
}

export function down(db) {
  db.exec(`
    UPDATE portal_detecciones
    SET detectado_at = datetime(detectado_at, '+3 hours')
    WHERE detectado_at IS NOT NULL AND trim(detectado_at) != '';
  `);
}

/**
 * Guarda último inicio de sesión y el anterior (para la barra de estado).
 */
export function up(db) {
  const cols = db.prepare(`PRAGMA table_info(usuarios)`).all();
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('ultimo_login')) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN ultimo_login TEXT`);
  }
  if (!names.has('login_anterior')) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN login_anterior TEXT`);
  }
}

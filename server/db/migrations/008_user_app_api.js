/** Puerto API REST de la User App en el FX9600. */
export function up(db) {
  const get = (key) => db.prepare('SELECT value FROM config WHERE key = ?').get(key)?.value;
  const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  if (!get('fx9600_app_port')) upsert.run('fx9600_app_port', '8765');
}

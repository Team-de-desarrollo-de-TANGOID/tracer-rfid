/** Config FX9600 real + desactivar demo por defecto en instalaciones nuevas. */
export function up(db) {
  const get = (key) => db.prepare('SELECT value FROM config WHERE key = ?').get(key)?.value;

  const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

  if (!get('fx9600_password')) upsert.run('fx9600_password', '');
  if (!get('fx9600_app_name')) upsert.run('fx9600_app_name', 'racketclub-gate');
  if (!get('fx9600_gpo_pin')) upsert.run('fx9600_gpo_pin', '1');
  if (!get('fx9600_scheme')) upsert.run('fx9600_scheme', 'https');

  const ip = get('fx9600_ip');
  if (!ip || ip === '192.168.1.100') {
    upsert.run('fx9600_ip', '169.254.240.149');
  }

  if (get('demo_mode') === 'true') {
    upsert.run('demo_mode', 'false');
  }
}

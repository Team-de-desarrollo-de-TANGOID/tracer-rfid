import bcrypt from 'bcryptjs';
import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_USERNAME,
} from '../../constants/permissions.js';

/**
 * Producción: desactiva demo, credenciales admin por defecto,
 * y deja de sembrar tags de demostración en DBs nuevas.
 */
export function up(db) {
  db.prepare(
    `INSERT INTO config (key, value) VALUES ('demo_mode', 'false')
     ON CONFLICT(key) DO UPDATE SET value = 'false'`
  ).run();

  db.prepare(
    `INSERT INTO config (key, value) VALUES ('r3_power', ?)
     ON CONFLICT(key) DO NOTHING`
  ).run(JSON.stringify({ ant1: 15, ant2: 15, ant3: 15, ant4: 15 }));

  const hash = bcrypt.hashSync(ADMIN_DEFAULT_PASSWORD, 10);

  // Renombrar admin legado -> Administrador (si no existe ya el nuevo username)
  const legacy = db
    .prepare(`SELECT id FROM usuarios WHERE username = 'admin' COLLATE NOCASE`)
    .get();
  const target = db
    .prepare(`SELECT id FROM usuarios WHERE username = ? COLLATE NOCASE`)
    .get(ADMIN_USERNAME);

  if (legacy && !target) {
    db.prepare(
      `UPDATE usuarios SET username = ?, password_hash = ?, nombre = 'Administrador' WHERE id = ?`
    ).run(ADMIN_USERNAME, hash, legacy.id);
  } else if (target) {
    db.prepare(
      `UPDATE usuarios SET password_hash = ?, nombre = 'Administrador', activo = 1 WHERE id = ?`
    ).run(hash, target.id);
  } else if (legacy && target && legacy.id !== target.id) {
    db.prepare(
      `UPDATE usuarios SET password_hash = ?, nombre = 'Administrador', activo = 1 WHERE id = ?`
    ).run(hash, target.id);
  }
}

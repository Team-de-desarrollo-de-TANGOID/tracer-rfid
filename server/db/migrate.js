import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { up as migration001 } from './migrations/001_phase1.js';
import { up as migration002 } from './migrations/002_ubicaciones_descripcion.js';
import { up as migration003 } from './migrations/003_tid_labels.js';
import { up as migration004 } from './migrations/004_edicion_rapida_permiso.js';
import { up as migration005 } from './migrations/005_propiedades_activos.js';
import { up as migration006 } from './migrations/006_auditoria_historial.js';
import { up as migration007 } from './migrations/007_fx9600_config.js';
import { up as migration008 } from './migrations/008_user_app_api.js';
import { up as migration009 } from './migrations/009_obligatoria_alta.js';
import { up as migration010 } from './migrations/010_lista_propiedades.js';
import { up as migration011 } from './migrations/011_tid_codigo.js';
import { up as migration012 } from './migrations/012_motivo_baja_sistema.js';
import { up as migration013 } from './migrations/013_propiedad_creado_por.js';
import { up as migration014 } from './migrations/014_portal_dashboard.js';
import { up as migration015 } from './migrations/015_dashboard_roles.js';
import { up as migration016 } from './migrations/016_portal_evento_index.js';
import { up as migration017 } from './migrations/017_portal_detecciones_fk.js';
import { up as migration018 } from './migrations/018_portal_detecciones_tz.js';
import { up as migration019 } from './migrations/019_dashboard_permisos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  const migrations = [
    { name: '001_phase1', up: migration001 },
    { name: '002_ubicaciones_descripcion', up: migration002 },
    { name: '003_tid_labels', up: migration003 },
    { name: '004_edicion_rapida_permiso', up: migration004 },
    { name: '005_propiedades_activos', up: migration005 },
    { name: '006_auditoria_historial', up: migration006 },
    { name: '007_fx9600_config', up: migration007 },
    { name: '008_user_app_api', up: migration008 },
    { name: '009_obligatoria_alta', up: migration009 },
    { name: '010_lista_propiedades', up: migration010 },
    { name: '011_tid_codigo', up: migration011 },
    { name: '012_motivo_baja_sistema', up: migration012 },
    { name: '013_propiedad_creado_por', up: migration013 },
    { name: '014_portal_dashboard', up: migration014 },
    { name: '015_dashboard_roles', up: migration015 },
    { name: '016_portal_evento_index', up: migration016 },
    { name: '017_portal_detecciones_fk', up: migration017 },
    { name: '018_portal_detecciones_tz', up: migration018 },
    { name: '019_dashboard_permisos', up: migration019 },
  ];

  for (const m of migrations) {
    const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(m.name);
    if (applied) continue;
    m.up(db);
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(m.name);
    console.log(`[DB] Migración aplicada: ${m.name}`);
  }
}

#!/usr/bin/env node
/**
 * Prueba sync y allow-list contra el FX9600 configurado en SQLite.
 * Uso: node scripts/test-fx9600-sync.mjs [--sync]
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.join(__dirname, '..'));

const { getDb } = await import('../server/db.js');
const fx = await import('../server/services/fx9600Service.js');

const doSync = process.argv.includes('--sync');

function cfg() {
  const db = getDb();
  const get = (k) => db.prepare('SELECT value FROM config WHERE key = ?').get(k)?.value;
  return {
    demo: get('demo_mode') === 'true',
    ip: get('fx9600_ip'),
    user: get('fx9600_user'),
    hasPassword: Boolean(get('fx9600_password')),
  };
}

const c = cfg();
console.log('Config:', c);
if (c.demo) {
  console.error('ERROR: demo_mode=true — desactívelo en Config o migración 007.');
  process.exit(1);
}
if (!c.ip) {
  console.error('ERROR: fx9600_ip no configurado.');
  process.exit(1);
}

const dbTids = fx.getAuthorizedTids();
console.log(`\nPC: ${dbTids.length} TID autorizados`);
if (dbTids.length) console.log('  ', dbTids.slice(0, 5).join(', '), dbTids.length > 5 ? '…' : '');

console.log('\nUser App (API REST)…');
const proc = await fx.fetchAppProcess();
console.log(' ', proc);

console.log('\nAllow-list en lector (REST)…');
const cmp = await fx.fetchAllowListCompare();
console.log('  Lector:', cmp.reader.count, 'TID, v' + cmp.reader.version, cmp.reader.restOk ? 'REST OK' : cmp.reader.error);
console.log('  En sync:', cmp.inSync);
if (cmp.onlyInDb.length) console.log('  Solo PC:', cmp.onlyInDb.join(', '));
if (cmp.onlyInReader.length) console.log('  Solo lector:', cmp.onlyInReader.join(', '));

if (doSync) {
  console.log('\nSincronizando…');
  const result = await fx.syncFx9600();
  console.log(' ', result);
  const after = await fx.fetchAllowListCompare();
  console.log('\nTras sync — lector:', after.reader.count, 'TID, en sync:', after.inSync);
  if (!after.inSync) {
    console.error('FAIL: aún desincronizado');
    process.exit(2);
  }
  console.log('OK: sync completado');
} else {
  console.log('\nPase --sync para ejecutar sincronización real.');
}

process.exit(cmp.inSync || doSync ? 0 : 1);

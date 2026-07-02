#!/usr/bin/env node
/**
 * Despliega racketclub_gate.py al FX9600 vía SSH (rfidadm) y arranca la app.
 * Uso: node scripts/fx9600-deploy.mjs
 */
import { initDb } from '../server/db.js';
import { deployUserAppViaSsh, saveFx9600Config, getReaderStatus } from '../server/services/fx9600Service.js';

const ip = process.env.FX9600_IP;
const password = process.env.FX9600_PASSWORD;

initDb();
if (ip || password) {
  saveFx9600Config({ ip, user: 'admin', password });
}

console.log(`Desplegando User App en ${ip}...`);
const result = await deployUserAppViaSsh();
console.log(result);

try {
  const st = await getReaderStatus();
  console.log('Estado lector:', JSON.stringify(st.status, null, 2));
} catch (e) {
  console.warn('REST status:', e.message);
}

console.log('\nListo. Sincronice desde la app o: curl POST /api/sync');

#!/usr/bin/env node
/**
 * Escanea IPs candidatas del FX9600 y prueba /cloud/localRestLogin
 * Uso: node scripts/fx9600-probe.mjs [ip] [password]
 */
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

const candidates = process.argv[2]
  ? [process.argv[2]]
  : [
      '169.254.240.149',
      '192.168.100.176',
      '192.168.1.100',
      ...Array.from({ length: 20 }, (_, i) => `192.168.100.${100 + i}`),
    ];

const password = process.argv[3] || process.env.FX9600_PASSWORD || '';

async function probe(ip, pw) {
  const url = `https://${ip}/cloud/localRestLogin`;
  const headers = pw
    ? { Authorization: `Basic ${Buffer.from(`admin:${pw}`).toString('base64')}` }
    : {};
  try {
    const res = await fetch(url, { method: 'GET', headers, agent, signal: AbortSignal.timeout(4000) });
    const json = await res.json();
    return { ip, json };
  } catch (e) {
    return { ip, error: e.message };
  }
}

console.log('Buscando FX9600...\n');
for (const ip of candidates) {
  const r = await probe(ip, password);
  if (r.json) {
    const ok = r.json.code === 0;
    console.log(`${ip}: code=${r.json.code} ${r.json.message?.slice?.(0, 60) || ''}${ok ? ' ✓' : ''}`);
    if (ok) {
      console.log('\nLector encontrado. Configure fx9600_ip y fx9600_password en la app.');
      process.exit(0);
    }
    if (r.json.message?.includes('Invalid password')) {
      console.log(`  → Lector Zebra en ${ip} (contraseña incorrecta)`);
    }
  }
}
console.log('\nNo se obtuvo login exitoso. Pase IP y contraseña: node scripts/fx9600-probe.mjs <ip> <password>');

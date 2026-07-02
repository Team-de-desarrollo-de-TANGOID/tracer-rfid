#!/usr/bin/env node
/**
 * Detiene racketclub-gate desde la PC (autostart off + stop app + stop inventario).
 *
 * PowerShell:
 *   $env:FX9600_IP = "169.254.240.149"
 *   $env:FX9600_PASSWORD = "tu_password"
 *   node hardware/fx9600/scripts/stop-gate-app.js
 */
import https from 'https';

const ip = process.env.FX9600_IP || '169.254.240.149';
const user = process.env.FX9600_USER || 'admin';
const password = process.env.FX9600_PASSWORD || '';
const appName = process.env.FX9600_APP_NAME || 'racketclub-gate';

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else headers.Authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    let payload = '';
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = https.request(
      {
        hostname: ip,
        port: 443,
        path,
        method,
        headers,
        rejectUnauthorized: false,
        timeout: 30000,
      },
      (res) => {
        let text = '';
        res.on('data', (c) => {
          text += c;
        });
        res.on('end', () => resolve({ status: res.statusCode, text }));
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  if (!password) {
    console.error('FX9600_PASSWORD requerida');
    process.exit(1);
  }
  const login = await req('GET', '/cloud/localRestLogin');
  const token = JSON.parse(login.text).message;

  let r = await req('PUT', `/cloud/apps/${appName}/autostart`, token, { autostart: false });
  console.log('autostart off:', r.status);

  r = await req('PUT', `/cloud/apps/${appName}/stop`, token, {});
  console.log('app stop:', r.status, r.text.slice(0, 120));

  r = await req('PUT', '/cloud/stop', token, {});
  console.log('inventory stop:', r.status, r.text.slice(0, 120));

  await new Promise((resolve) => setTimeout(resolve, 3000));
  r = await req('GET', '/cloud/apps', token);
  console.log('estado final:', r.text);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

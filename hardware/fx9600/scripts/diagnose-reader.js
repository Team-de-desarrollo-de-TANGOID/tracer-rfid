#!/usr/bin/env node
/** Diagnóstico rápido FX9600: mapping, /cloud/start, apps instaladas. */
import https from 'https';

const ip = process.env.FX9600_IP || '169.254.240.149';
const user = process.env.FX9600_USER || 'admin';
const password = process.env.FX9600_PASSWORD || '';

function httpsJson(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/json' };
    if (body != null) {
      headers['Content-Type'] = 'application/json';
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (password) {
      headers.Authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    }
    const req = https.request(
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
        res.on('end', () => {
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('error', reject);
    if (body != null) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  if (!password) {
    console.error('FX9600_PASSWORD requerida');
    process.exit(1);
  }

  console.log('=== Login ===');
  const login = await httpsJson('GET', '/cloud/localRestLogin');
  const token = login.json?.message;
  console.log('login:', login.status, token ? 'OK' : login.text?.slice(0, 120));

  console.log('\n=== /cloud/status ===');
  const status = await httpsJson('GET', '/cloud/status', { token });
  console.log(JSON.stringify(status.json, null, 2));

  console.log('\n=== /cloud/apps ===');
  const apps = await httpsJson('GET', '/cloud/apps', { token });
  console.log(JSON.stringify(apps.json, null, 2));

  console.log('\n=== PUT /cloud/start (prueba RC API) ===');
  const start = await httpsJson('PUT', '/cloud/start', {
    token,
    body: { doNotPersistState: true },
  });
  console.log('start:', start.status, start.text?.slice(0, 300));

  console.log('\n=== PUT /cloud/stop ===');
  const stop = await httpsJson('PUT', '/cloud/stop', { token, body: {} });
  console.log('stop:', stop.status, stop.text?.slice(0, 300));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Configura IoT Connector en el FX9600 para permitir /cloud/start con User App.
 */
import https from 'https';
import { getDb } from '../db.js';

const ENDPOINT_NAME = 'racketclub-local';

function getFx9600Config() {
  const db = getDb();
  const get = (k) => db.prepare('SELECT value FROM config WHERE key = ?').get(k)?.value;
  return {
    ip: get('fx9600_ip') || process.env.FX9600_IP || '169.254.240.149',
    user: get('fx9600_user') || process.env.FX9600_USER || 'admin',
    password: get('fx9600_password') || process.env.FX9600_PASSWORD || '',
    appPort: Number(get('fx9600_app_port') || process.env.FX9600_APP_PORT || 8765),
  };
}

function postControl(ip, xml) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ip,
        port: 443,
        path: '/control',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(xml),
        },
        rejectUnauthorized: false,
        timeout: 90000,
      },
      (res) => {
        let text = '';
        res.on('data', (c) => {
          text += c;
        });
        res.on('end', () => resolve({ status: res.statusCode, text }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('RM /control timeout')));
    req.write(xml);
    req.end();
  });
}

function rmEnvelope(sessionId, inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rm:command xmlns:rm="urn:epcglobal:rm:xsd:1" xmlns:epcglobal="urn:epcglobal:xsd:1" xmlns:motorm="urn:motorfid:rm:xsd:1">
  <rm:id>1</rm:id>
  <rm:targetName></rm:targetName>
  <motorm:readerDevice>
    ${sessionId ? `<motorm:sessionID>${sessionId}</motorm:sessionID>` : ''}
    ${inner}
  </motorm:readerDevice>
</rm:command>`;
}

function parseResult(text) {
  const code = Number(text.match(/<g1:resultCode>(\d+)<\/g1:resultCode>/)?.[1] ?? -1);
  const err = text.match(/<g1:description>([^<]*)<\/g1:description>/)?.[1];
  if (code !== 0) {
    const e = new Error(err || `RM resultCode ${code}`);
    e.resultCode = code;
    throw e;
  }
  const dataJson = text.match(/<g3:data>([\s\S]*?)<\/g3:data>/)?.[1];
  if (dataJson) {
    try {
      return JSON.parse(dataJson);
    } catch {
      return dataJson;
    }
  }
  return null;
}

async function rmLogin(ip, user, password) {
  const xml = rmEnvelope(
    '',
    `<motorm:doLogin>
      <motorm:username>${user}</motorm:username>
      <motorm:password>${password}</motorm:password>
      <motorm:forceLogin>true</motorm:forceLogin>
    </motorm:doLogin>`
  );
  const { text } = await postControl(ip, xml);
  const sessionId = text.match(/<g3:sessionID>([^<]+)<\/g3:sessionID>/)?.[1];
  if (!sessionId) throw new Error('RM login sin sessionID');
  return sessionId;
}

async function rmCall(ip, sessionId, inner) {
  const { text } = await postControl(ip, rmEnvelope(sessionId, inner));
  return parseResult(text);
}

function endpointPayload(appPort) {
  return {
    name: ENDPOINT_NAME,
    description: 'Racket Club tag sink localhost',
    type: 'HTTP-POST',
    configuration: {
      url: `127.0.0.1:${appPort}/api/iot-tag-events`,
      security: {
        verifyPeer: false,
        verifyHost: false,
        authenticationType: 'NONE',
      },
    },
  };
}

function mappingPayload() {
  return {
    control: { enableLocalRest: true, endpoints: [] },
    management: { enableLocalRest: true, endpoints: [] },
    data: [ENDPOINT_NAME],
    event: [],
  };
}

/**
 * Idempotente: registra HTTP POST local + mapping y reconecta IoT Connector.
 */
export async function ensureIoTConnectorForUserApp(overrides = {}) {
  const { ip, user, password, appPort } = { ...getFx9600Config(), ...overrides };
  if (!password) {
    throw new Error('Contraseña admin FX9600 requerida para configurar IoT Connector');
  }

  const sessionId = await rmLogin(ip, user, password);
  let needsSetup = true;

  try {
    const { loginFx9600 } = await import('./fx9600Service.js');
    const token = await loginFx9600();
    const statusRes = await new Promise((resolve, reject) => {
      https.get(
        {
          hostname: ip,
          port: 443,
          path: '/cloud/status',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          rejectUnauthorized: false,
          timeout: 20000,
        },
        (res) => {
          let text = '';
          res.on('data', (c) => {
            text += c;
          });
          res.on('end', () => resolve({ status: res.statusCode, text }));
        }
      ).on('error', reject);
    });
    if (statusRes.status === 200) {
      const status = JSON.parse(statusRes.text);
      const dataIfaces = status.interfaceConnectionStatus?.data || [];
      if (
        dataIfaces.some(
          (row) =>
            row.interface === ENDPOINT_NAME ||
            (row.description || '').toLowerCase().includes('racket club')
        )
      ) {
        needsSetup = false;
      }
    }
  } catch {
    // seguir con setup
  }

  if (!needsSetup) {
    return { ok: true, endpoint: ENDPOINT_NAME, configured: false, skipped: true };
  }

  try {
    await rmCall(
      ip,
      sessionId,
      `<motorm:manageCloudEndpoints>
        <motorm:operation>DELETE</motorm:operation>
        <motorm:data>${ENDPOINT_NAME}</motorm:data>
      </motorm:manageCloudEndpoints>`
    );
  } catch {
    // endpoint puede no existir
  }

  await rmCall(
    ip,
    sessionId,
    `<motorm:manageCloudEndpoints>
      <motorm:operation>ADD</motorm:operation>
      <motorm:data>${JSON.stringify(endpointPayload(appPort))}</motorm:data>
    </motorm:manageCloudEndpoints>`
  );

  await rmCall(
    ip,
    sessionId,
    `<motorm:cloudEndpointsMapping>
      <motorm:operation>UPDATE</motorm:operation>
      <motorm:data>${JSON.stringify(mappingPayload())}</motorm:data>
    </motorm:cloudEndpointsMapping>`
  );

  try {
    await rmCall(ip, sessionId, '<motorm:disconnectFromCloud/>');
  } catch {
    // LLRP puede estar reiniciando; connect suele bastar
  }
  try {
    await rmCall(ip, sessionId, '<motorm:connectToCloud/>');
  } catch (e) {
    if (/LLRP initializing/i.test(e.message || '')) {
      const err = new Error(
        'IoT Connector: LLRP inicializando en el lector — espere 30 s y sincronice de nuevo'
      );
      err.retryLater = true;
      throw err;
    }
    throw e;
  }

  return { ok: true, endpoint: ENDPOINT_NAME, configured: true };
}

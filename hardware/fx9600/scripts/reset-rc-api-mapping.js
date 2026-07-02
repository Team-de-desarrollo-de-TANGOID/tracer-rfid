#!/usr/bin/env node
/**
 * Restaura IoT Connector mapping para apps User App (Tag-Detection / racketclub-gate).
 * Quita LLRP (u otros) del interface Data y habilita Local REST en control/management.
 *
 * Uso:
 *   FX9600_IP=169.254.240.149 FX9600_PASSWORD=secret node hardware/fx9600/scripts/reset-rc-api-mapping.js
 */
import https from 'https';

const ip = process.env.FX9600_IP || '169.254.240.149';
const user = process.env.FX9600_USER || 'admin';
const password = process.env.FX9600_PASSWORD || '';

const ENDPOINT_NAME = 'racketclub-sink';

const endpointPayload = {
  name: ENDPOINT_NAME,
  description: 'Sink local (User App usa pyziotc, no este HTTP)',
  type: 'HTTP-POST',
  configuration: {
    url: '127.0.0.1:1',
    security: {
      verifyPeer: false,
      verifyHost: false,
      authenticationType: 'NONE',
    },
  },
};

/** Data no puede quedar vacio ni LLRP: el firmware bloquea /cloud/* si no hay HTTP/MQTT en Data. */
const mappingPayload = {
  control: { enableLocalRest: true, endpoints: [] },
  management: { enableLocalRest: true, endpoints: [] },
  data: [ENDPOINT_NAME],
  event: [],
};

function postControl(xml) {
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

async function rmLogin() {
  const xml = rmEnvelope(
    '',
    `<motorm:doLogin>
      <motorm:username>${user}</motorm:username>
      <motorm:password>${password}</motorm:password>
      <motorm:forceLogin>true</motorm:forceLogin>
    </motorm:doLogin>`
  );
  const { text } = await postControl(xml);
  const sessionId = text.match(/<g3:sessionID>([^<]+)<\/g3:sessionID>/)?.[1];
  if (!sessionId) throw new Error('RM login sin sessionID');
  return sessionId;
}

async function rmCall(sessionId, inner) {
  const { text } = await postControl(rmEnvelope(sessionId, inner));
  return parseResult(text);
}

async function main() {
  if (!password) {
    console.error('Defina FX9600_PASSWORD (admin del lector).');
    process.exit(1);
  }

  console.log(`Conectando a ${ip}...`);
  const sessionId = await rmLogin();

  const before = await rmCall(
    sessionId,
    `<motorm:cloudEndpointsMapping>
      <motorm:operation>VIEW</motorm:operation>
      <motorm:data></motorm:data>
    </motorm:cloudEndpointsMapping>`
  );
  console.log('Mapping actual:', JSON.stringify(before, null, 2));

  try {
    await rmCall(
      sessionId,
      `<motorm:manageCloudEndpoints>
        <motorm:operation>DELETE</motorm:operation>
        <motorm:data>${ENDPOINT_NAME}</motorm:data>
      </motorm:manageCloudEndpoints>`
    );
  } catch {
    // puede no existir
  }

  await rmCall(
    sessionId,
    `<motorm:manageCloudEndpoints>
      <motorm:operation>ADD</motorm:operation>
      <motorm:data>${JSON.stringify(endpointPayload)}</motorm:data>
    </motorm:manageCloudEndpoints>`
  );
  console.log(`Endpoint HTTP-POST "${ENDPOINT_NAME}" registrado.`);

  await rmCall(
    sessionId,
    `<motorm:cloudEndpointsMapping>
      <motorm:operation>UPDATE</motorm:operation>
      <motorm:data>${JSON.stringify(mappingPayload)}</motorm:data>
    </motorm:cloudEndpointsMapping>`
  );
  console.log('Mapping actualizado (Data -> HTTP-POST, Local REST en control/management).');

  try {
    await rmCall(sessionId, '<motorm:disconnectFromCloud/>');
  } catch {
    // puede fallar si no estaba conectado
  }
  await rmCall(sessionId, '<motorm:connectToCloud/>');
  console.log('IoT Connector reconectado (espere ~10 s antes de reiniciar la app).');

  const after = await rmCall(
    sessionId,
    `<motorm:cloudEndpointsMapping>
      <motorm:operation>VIEW</motorm:operation>
      <motorm:data></motorm:data>
    </motorm:cloudEndpointsMapping>`
  );
  console.log('Mapping final:', JSON.stringify(after, null, 2));
  console.log('Listo. Reinicie racketclub-gate desde Applications en la consola web.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

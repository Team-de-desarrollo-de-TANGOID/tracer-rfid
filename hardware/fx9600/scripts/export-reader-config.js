#!/usr/bin/env node
/** Exporta cloud config + LLRP state del FX9600 vía RM. */
import https from 'https';

const ip = process.env.FX9600_IP || '169.254.240.149';
const user = process.env.FX9600_USER || 'admin';
const password = process.env.FX9600_PASSWORD || '';

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
        res.on('end', () => resolve(text));
      }
    );
    req.on('error', reject);
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

function parseDataJson(text) {
  const dataJson = text.match(/<g3:data>([\s\S]*?)<\/g3:data>/)?.[1];
  if (!dataJson) return null;
  try {
    return JSON.parse(dataJson);
  } catch {
    return dataJson;
  }
}

async function rmLogin() {
  const text = await postControl(
    rmEnvelope(
      '',
      `<motorm:doLogin>
        <motorm:username>${user}</motorm:username>
        <motorm:password>${password}</motorm:password>
        <motorm:forceLogin>true</motorm:forceLogin>
      </motorm:doLogin>`
    )
  );
  const sessionId = text.match(/<g3:sessionID>([^<]+)<\/g3:sessionID>/)?.[1];
  if (!sessionId) throw new Error('RM login failed');
  return sessionId;
}

async function rmCall(sessionId, tag, empty = false) {
  const inner = empty
    ? `<motorm:${tag}/>`
    : `<motorm:${tag}><motorm:data></motorm:data></motorm:${tag}>`;
  const text = await postControl(rmEnvelope(sessionId, inner));
  const code = Number(text.match(/<g1:resultCode>(\d+)<\/g1:resultCode>/)?.[1] ?? -1);
  if (code !== 0) {
    const err = text.match(/<g1:description>([^<]*)<\/g1:description>/)?.[1];
    throw new Error(err || `RM ${tag} code ${code}`);
  }
  return parseDataJson(text) ?? text;
}

async function main() {
  const sid = await rmLogin();
  console.log('=== cloudEndpointsMapping VIEW ===');
  console.log(
    JSON.stringify(
      await rmCall(
        sid,
        'cloudEndpointsMapping',
        false
      ).catch(async () => {
        const text = await postControl(
          rmEnvelope(
            sid,
            `<motorm:cloudEndpointsMapping>
              <motorm:operation>VIEW</motorm:operation>
              <motorm:data></motorm:data>
            </motorm:cloudEndpointsMapping>`
          )
        );
        return parseDataJson(text);
      }),
      null,
      2
    )
  );

  console.log('\n=== exportCloudConfigFromReader ===');
  const exportText = await postControl(rmEnvelope(sid, '<motorm:exportCloudConfigFromReader/>'));
  const exportData = parseDataJson(exportText);
  console.log(typeof exportData === 'string' ? exportData.slice(0, 4000) : JSON.stringify(exportData, null, 2));

  console.log('\n=== getLLRPConfig ===');
  const llrpText = await postControl(
    rmEnvelope(sid, '<motorm:getLLRPConfig><motorm:isCoreConfig>true</motorm:isCoreConfig></motorm:getLLRPConfig>')
  );
  console.log(llrpText.replace(/\s+/g, ' ').slice(0, 1500));

  console.log('\n=== isLLRPConnected ===');
  const connText = await postControl(rmEnvelope(sid, '<motorm:isLLRPConnected/>'));
  console.log(connText.replace(/\s+/g, ' ').slice(0, 800));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

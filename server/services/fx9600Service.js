import https from 'https';
import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDb } from '../db.js';

const execFileAsync = promisify(execFile);

let cachedToken = null;
let tokenExpiresAt = 0;
let restChain = Promise.resolve();

/** El FX9600 procesa una sola petición REST a la vez; serializamos todo el tráfico. */
function runSerializedRest(task) {
  const next = restChain.then(task, task);
  restChain = next.catch(() => {});
  return next;
}

function cfg(key, envKey) {
  if (process.env[envKey]) return process.env[envKey];
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row?.value ?? '';
}

export function getFx9600Config() {
  return {
    ip: cfg('fx9600_ip', 'FX9600_IP') || '169.254.240.149',
    user: cfg('fx9600_user', 'FX9600_USER') || 'admin',
    password: cfg('fx9600_password', 'FX9600_PASSWORD') || '',
    sshUser: cfg('fx9600_ssh_user', 'FX9600_SSH_USER') || 'rfidadm',
    appName: cfg('fx9600_app_name', 'FX9600_APP_NAME') || 'racketclub-gate',
    appPort: Number(cfg('fx9600_app_port', 'FX9600_APP_PORT') || '8765'),
    appToken: cfg('fx9600_app_token', 'FX9600_APP_TOKEN') || '',
    gpoPin: Number(cfg('fx9600_gpo_pin', 'FX9600_GPO_PIN') || '1'),
    scheme: cfg('fx9600_scheme', 'FX9600_SCHEME') || 'https',
  };
}

function baseUrl() {
  const { ip, scheme } = getFx9600Config();
  return `${scheme}://${ip}`;
}

function fxRequest(method, path, options = {}) {
  const { body, token, auth, timeoutMs } = options;
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${baseUrl()}${path}`);
    const headers = { Accept: 'application/json' };
    if (body != null) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (auth) {
      headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString('base64')}`;
    }

    const payload =
      body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers,
        rejectUnauthorized: false,
        timeout: options.timeoutMs ?? 90000,
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
          if (!res.statusCode || res.statusCode >= 400) {
            if (json?.code === undefined) {
              const err = new Error(json?.message || json?.raw || `HTTP ${res.statusCode}`);
              err.status = res.statusCode;
              err.payload = json;
              reject(err);
              return;
            }
          }
          if (json?.code !== undefined && json.code !== 0) {
            const err = new Error(json.message || `FX9600 error code ${json.code}`);
            err.code = json.code;
            err.payload = json;
            reject(err);
            return;
          }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('FX9600 request timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

export async function loginFx9600(force = false) {
  const now = Date.now();
  if (!force && cachedToken && tokenExpiresAt > now + 5000) {
    return cachedToken;
  }

  const { user, password } = getFx9600Config();
  if (!password) {
    throw new Error(
      'Contraseña del FX9600 no configurada. Defina fx9600_password en Config o variable FX9600_PASSWORD.'
    );
  }

  const { json } = await fxRequest('GET', '/cloud/localRestLogin', {
    auth: { user, password },
    timeoutMs: 90000,
  });

  const token = json?.message;
  if (!token || typeof token !== 'string') {
    throw new Error('No se recibió token del lector FX9600');
  }

  cachedToken = token;
  tokenExpiresAt = now + 25 * 60 * 1000;
  return token;
}

async function withToken(fn) {
  return runSerializedRest(async () => {
    try {
      return await fn(cachedToken || (await loginFx9600()));
    } catch (e) {
      if (e.code === -1 || e.status === 401) {
        cachedToken = null;
        return fn(await loginFx9600(true));
      }
      throw e;
    }
  });
}

async function sshExec(command) {
  const { ip, sshUser } = getFx9600Config();
  const { stdout, stderr } = await execFileAsync(
    'ssh',
    ['-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=12', `${sshUser}@${ip}`, command],
    { timeout: 30000, maxBuffer: 2 * 1024 * 1024 }
  );
  return (stdout || '') + (stderr || '');
}

async function scpToReader(localPath, remotePath) {
  const { ip, sshUser } = getFx9600Config();
  await execFileAsync(
    'scp',
    ['-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=12', localPath, `${sshUser}@${ip}:${remotePath}`],
    { timeout: 60000 }
  );
}

export async function pushReaderCredentialsToUserApp() {
  const { user, password } = getFx9600Config();
  if (!password) {
    return { ok: false, error: 'Contraseña FX9600 no configurada en la PC' };
  }
  const result = await callUserAppApi(
    'POST',
    '/api/credentials',
    { readerUser: user, readerPassword: password },
    { timeoutMs: 20000 }
  );
  return { ok: true, ...result };
}

export async function deployUserAppViaSsh() {
  const { ip } = getFx9600Config();
  const pkgDir = join(process.cwd(), 'hardware', 'fx9600', 'pkg');
  const files = [
    'racketclub_gate.py',
    'RestAPI.py',
    'Logger.py',
    'INIFile.py',
    'config.ini',
    'start_racketclub-gate.sh',
    'stop_racketclub-gate.sh',
  ];
  for (const name of files) {
    await scpToReader(join(pkgDir, name), `/apps/${name}`);
  }
  await sshExec(
    "sed -i 's/\\r$//' /apps/*.py /apps/*.sh /apps/config.ini 2>/dev/null; " +
      'chmod +x /apps/racketclub_gate.py /apps/*.sh && ' +
      'nohup /apps/start_racketclub-gate.sh >>/tmp/racketclub-gate.log 2>&1 & sleep 2; ' +
      'pgrep -f racketclub_gate.py || true'
  );
  return {
    ok: true,
    ip,
    message: 'Fase 1 desplegada en /apps/ (solo log de lecturas)',
  };
}

export async function syncAllowListViaSsh(payload) {
  const tmp = join(tmpdir(), `racketclub-allowlist-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  try {
    await scpToReader(tmp, '/apps/racketclub_allowlist.json');
    await sshExec(
      "pgrep -f racketclub_gate.py >/dev/null || nohup /apps/start_racketclub-gate.sh >/tmp/racketclub-gate.log 2>&1 &"
    );
    return { ok: true, count: payload.tids?.length ?? 0, method: 'ssh' };
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export async function getReaderStatus() {
  const raw = getFx9600Config();
  const config = { ...raw, password: raw.password ? '***' : '' };

  try {
    const appStatus = await callUserAppApi('GET', '/api/status', null, { timeoutMs: 15000 });
    return {
      connected: true,
      appOk: true,
      appStatus,
      config,
    };
  } catch (e) {
    return {
      connected: false,
      appOk: false,
      appError: e.message,
      error: e.message,
      config,
    };
  }
}

export async function probeUserApp(overrides = {}) {
  const cfg = getFx9600Config();
  const ip = overrides.ip ?? cfg.ip;
  const appPort = overrides.appPort ?? cfg.appPort;
  try {
    const data = await runSerializedRest(() =>
      userAppRequest('GET', '/api/health', null, { ip, appPort, timeoutMs: 10000 })
    );
    return { ok: true, ip, appPort, message: 'User App API responde correctamente', ...data };
  } catch (e) {
    return { ok: false, ip, appPort, error: e.message, message: e.message };
  }
}

export async function ensureSimpleMode(antennas = [1]) {
  return withToken(async (token) => {
    const modeBody = {
      mode: 'simple',
      antennas,
      transmitPower: 25,
    };
    await fxRequest('PUT', '/cloud/mode', { token, body: modeBody });
    return modeBody;
  });
}

export async function startInventory() {
  return withToken(async (token) => {
    await fxRequest('PUT', '/cloud/start', { token, body: {} });
  });
}

export async function stopInventory() {
  return withToken(async (token) => {
    await fxRequest('PUT', '/cloud/stop', { token, body: {} });
  });
}

function userAppBaseUrl() {
  const { ip, appPort } = getFx9600Config();
  return `http://${ip}:${appPort}`;
}

function userAppRequest(method, apiPath, body = null, options = {}) {
  const { appToken, ip: cfgIp, appPort: cfgPort } = getFx9600Config();
  const hostname = options.ip ?? cfgIp;
  const port = options.appPort ?? cfgPort;
  return new Promise((resolve, reject) => {
    const url = new URL(
      apiPath.startsWith('http') ? apiPath : `http://${hostname}:${port}${apiPath}`
    );
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (appToken) headers['X-RacketClub-Token'] = appToken;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: options.timeoutMs ?? 30000,
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
            json = { ok: false, error: text || `HTTP ${res.statusCode}` };
          }
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(json?.error || text || `User App HTTP ${res.statusCode}`));
            return;
          }
          if (json?.ok === false) {
            reject(new Error(json.error || 'User App respondió con error'));
            return;
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('User App request timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

export async function callUserAppApi(method, apiPath, body = null, options = {}) {
  return userAppRequest(method, apiPath, body, options);
}

export async function testGpo(pin, state = true) {
  return withToken(async (token) => {
    await fxRequest('PUT', '/cloud/gpo', {
      token,
      body: { port: pin, state },
    });
  });
}

export function getAuthorizedTids() {
  return getDb()
    .prepare(
      `SELECT UPPER(TRIM(a.epc)) AS tid
       FROM activos a
       JOIN estados e ON e.id = a.estado_id
       WHERE e.es_activo = 1 AND e.permite_salida = 0
         AND a.epc IS NOT NULL AND TRIM(a.epc) != ''`
    )
    .all()
    .map((r) => r.tid);
}

export async function syncFx9600(usuarioId = null) {
  const start = Date.now();
  const tids = getAuthorizedTids();
  const version =
    (getDb().prepare('SELECT COALESCE(MAX(version),0)+1 AS v FROM sync_log').get().v) || 1;

  const { gpoPin } = getFx9600Config();
  const steps = ['user-app-api'];
  const syncMethod = 'user-app-rest';

  const result = await callUserAppApi(
    'POST',
    '/api/sync',
    { tids, version, gpoPin },
    { timeoutMs: 30000 }
  );
  const appResponse = JSON.stringify(result);
  steps.push('sync-full');

  const duracion = Date.now() - start;
  const total = tids.length;
  const removed = result.removed?.length ?? 0;
  const added = result.added?.length ?? 0;
  const mensaje =
    total === 0
      ? `Lista vacía sincronizada (v${version}). Se eliminaron ${removed} TID del lector.`
      : `Sync completa en FX9600: ${total} TID autorizados (v${version}, +${added} -${removed}).`;

  getDb()
    .prepare(
      `INSERT INTO sync_log (fecha, total_enviados, exito, mensaje, duracion_ms, version)
       VALUES (datetime('now','localtime'), ?, 1, ?, ?, ?)`
    )
    .run(total, mensaje, duracion, version);

  getDb()
    .prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('ultima_sync', datetime('now','localtime'))`)
    .run();

  if (usuarioId) {
    const { registrarEvento } = await import('./eventosService.js');
    registrarEvento({
      epc: 'SYNC-BATCH',
      tipo: 'SYNC_ENVIADO',
      usuarioId,
      origen: 'sistema',
      metadata: { version, total, modo: 'fx9600', steps, syncMethod },
      notas: mensaje,
    });
  }

  return {
    total,
    mensaje,
    modo: 'fx9600',
    version,
    duracionMs: duracion,
    steps,
    syncMethod,
    appResponse,
  };
}

export async function probeFx9600(ip, user = 'admin', password = '') {
  if (!password) {
    return { ip, ok: false, json: { message: 'Password required' } };
  }
  try {
    const { json } = await fxRequest('GET', `https://${ip}/cloud/localRestLogin`, {
      auth: { user, password },
      timeoutMs: 30000,
    });
    return { ip, ok: json?.code === 0, json };
  } catch (e) {
    return { ip, ok: false, error: e.message, json: { message: e.message } };
  }
}

export async function fetchAppLogChunk(fromByte = 0) {
  try {
    const data = await callUserAppApi(
      'GET',
      `/api/logs?offset=${fromByte}&maxBytes=65536`,
      null,
      { timeoutMs: 15000 }
    );
    return {
      size: data.size ?? fromByte,
      lines: data.lines ?? '',
      restOk: true,
    };
  } catch (e) {
    return { size: fromByte, lines: '', restOk: false, error: e.message };
  }
}

export async function fetchAppProcess() {
  try {
    const data = await callUserAppApi('GET', '/api/status', null, { timeoutMs: 15000 });
    return {
      running: true,
      pid: data.pid != null ? String(data.pid) : null,
      restOk: true,
      app: data.app,
      appVersion: data.appVersion,
      count: data.count,
      version: data.version,
    };
  } catch (e) {
    return { running: false, pid: null, restOk: false, error: e.message };
  }
}

export async function fetchAllowListSummary() {
  const full = await fetchAllowListFromReader();
  return {
    version: full.version,
    count: full.count,
    gpoPin: full.gpoPin,
    updatedAt: full.updatedAt,
    restOk: full.restOk,
    error: full.error,
  };
}

export async function fetchReaderStatusQuick() {
  const { ip, appPort } = getFx9600Config();
  try {
    await callUserAppApi('GET', '/api/health', null, { timeoutMs: 10000 });
    return { ok: true, ip, appPort, status: { message: 'User App API OK' } };
  } catch (e) {
    return { ok: false, ip, appPort, error: e.message };
  }
}

export async function fetchAllowListFromReader() {
  try {
    const data = await callUserAppApi('GET', '/api/allowlist', null, { timeoutMs: 15000 });
    const tids = Array.isArray(data.tids)
      ? data.tids.map((t) => String(t).toUpperCase().trim()).filter(Boolean)
      : [];
    return {
      version: data.version ?? 0,
      tids,
      count: data.count ?? tids.length,
      gpoPin: data.gpoPin ?? null,
      updatedAt: data.updatedAt ?? null,
      restOk: true,
    };
  } catch (e) {
    return { version: 0, tids: [], count: 0, restOk: false, error: e.message };
  }
}

export async function fetchAllowListCompare() {
  const reader = await fetchAllowListFromReader();
  const dbTids = getAuthorizedTids().sort();
  const readerTids = [...reader.tids].sort();
  const dbSet = new Set(dbTids);
  const readerSet = new Set(readerTids);
  const onlyInDb = dbTids.filter((t) => !readerSet.has(t));
  const onlyInReader = readerTids.filter((t) => !dbSet.has(t));
  const inSync = onlyInDb.length === 0 && onlyInReader.length === 0;
  return { reader, dbTids, onlyInDb, onlyInReader, inSync };
}

export async function fetchTagEvents(since = 0) {
  try {
    const data = await callUserAppApi(
      'GET',
      `/api/tag-events?since=${since}`,
      null,
      { timeoutMs: 15000 }
    );
    return {
      since: data.since ?? since,
      latest: data.latest ?? since,
      events: data.events ?? [],
      restOk: true,
    };
  } catch (e) {
    return { since, latest: since, events: [], restOk: false, error: e.message };
  }
}

export async function fetchMonitorSnapshot(logOffset = 0) {
  const ts = new Date().toISOString();
  const config = { ...getFx9600Config(), password: getFx9600Config().password ? '***' : '' };
  const reader = await fetchReaderStatusQuick();
  const process = await fetchAppProcess();
  const allowList = await fetchAllowListSummary();
  const logs = await fetchAppLogChunk(logOffset);
  return {
    ts,
    config,
    logs,
    process,
    allowList,
    reader,
    logOffset: logs.size,
  };
}

export function saveFx9600Config({ ip, user, password, appName, gpoPin, appPort }) {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  if (ip != null) upsert.run('fx9600_ip', ip);
  if (user != null) upsert.run('fx9600_user', user);
  if (password != null && password !== '') upsert.run('fx9600_password', password);
  if (appName != null) upsert.run('fx9600_app_name', appName);
  if (gpoPin != null) upsert.run('fx9600_gpo_pin', String(gpoPin));
  if (appPort != null) upsert.run('fx9600_app_port', String(appPort));
  cachedToken = null;
}

import https from 'https';
import http from 'http';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDb } from '../db.js';
import { scpUploadWithPassword, sshExecWithPassword } from './fx9600Ssh.js';
import { normalizeTid } from '../utils/tid.js';

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
    sshPassword: cfg('fx9600_ssh_password', 'FX9600_SSH_PASSWORD') || '',
    appName: cfg('fx9600_app_name', 'FX9600_APP_NAME') || 'racketclub-gate',
    appPort: Number(cfg('fx9600_app_port', 'FX9600_APP_PORT') || '8765'),
    appToken: cfg('fx9600_app_token', 'FX9600_APP_TOKEN') || '',
    gpoPin: Number(cfg('fx9600_gpo_pin', 'FX9600_GPO_PIN') || '1'),
    scheme: cfg('fx9600_scheme', 'FX9600_SCHEME') || 'https',
    portalWebhookUrl: cfg('portal_webhook_url', 'PORTAL_WEBHOOK_URL') || '',
  };
}

/** URL base de esta API alcanzable desde el FX9600 (sin /api/portal/alert). */
export function getLocalIpv4Addresses() {
  const addrs = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface || []) {
      if (addr.family === 'IPv4' && !addr.internal) addrs.push(addr.address);
    }
  }
  return addrs;
}

function pickLocalIpForReader(readerIp) {
  if (!readerIp) return null;
  const locals = getLocalIpv4Addresses();
  if (readerIp.startsWith('169.254.')) {
    const linkLocal = locals.find((a) => a.startsWith('169.254.'));
    if (linkLocal) return linkLocal;
  }
  const prefix = readerIp.split('.').slice(0, 3).join('.');
  const sameSubnet = locals.find((a) => a.startsWith(`${prefix}.`));
  if (sameSubnet) return sameSubnet;
  return locals[0] ?? null;
}

export function resolvePortalWebhookUrl(readerIp) {
  const configured = getFx9600Config().portalWebhookUrl?.trim();
  const targetReader = readerIp || getFx9600Config().ip || '';
  const port = Number(process.env.API_PORT) || 3847;

  if (configured && targetReader) {
    const local = pickLocalIpForReader(targetReader);
    if (local && configured.includes('127.0.0.1')) {
      return `http://${local}:${port}`;
    }
  }

  if (configured && !configured.includes('127.0.0.1')) {
    return configured.replace(/\/+$/, '');
  }

  const local = pickLocalIpForReader(targetReader);
  if (local) return `http://${local}:${port}`;

  return `http://127.0.0.1:${port}`;
}

/** Normaliza IP o URL a la base que usa el FX (sin /api/portal/alert). */
export function normalizePortalWebhookUrl(input) {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  const defaultPort = String(Number(process.env.API_PORT) || 3847);
  try {
    const u = new URL(s);
    const port = u.port || defaultPort;
    return `${u.protocol}//${u.hostname}:${port}`;
  } catch {
    return s.replace(/\/+$/, '').replace(/\/api\/portal\/alert$/i, '');
  }
}

function buildReaderDiscoveryCandidates() {
  const cfg = getFx9600Config();
  const candidates = new Set();
  if (cfg.ip) candidates.add(cfg.ip);
  candidates.add('169.254.240.149');

  for (const local of getLocalIpv4Addresses()) {
    const parts = local.split('.');
    const prefix = parts.slice(0, 3).join('.');
    const priorityHosts = [149, 150, 1, 2, 10, 20, 100, Number(parts[3])];
    if (prefix === '169.254.240') {
      for (let h = 140; h <= 160; h++) priorityHosts.push(h);
    }
    for (const host of priorityHosts) {
      if (host >= 1 && host <= 254) candidates.add(`${prefix}.${host}`);
    }
  }

  return [...candidates];
}

function probeUserAppAt(ip, appPort, appToken, timeoutMs = 900) {
  return new Promise((resolve) => {
    const headers = { Accept: 'application/json' };
    if (appToken) headers['X-RacketClub-Token'] = appToken;

    const req = http.request(
      {
        hostname: ip,
        port: appPort,
        path: '/api/health',
        method: 'GET',
        headers,
        timeout: timeoutMs,
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
            json = null;
          }
          resolve({
            ip,
            appPort,
            status: res.statusCode ?? 0,
            json,
            reachable: true,
            ok: res.statusCode === 200 && json?.ok === true,
            authError: res.statusCode === 401,
            app: json?.app,
          });
        });
      }
    );
    req.on('error', () => resolve({ ip, appPort, reachable: false, ok: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ip, appPort, reachable: false, ok: false });
    });
    req.end();
  });
}

/** Busca el FX9600 en la red local (User App :8765). */
export async function discoverReaderOnNetwork(overrides = {}) {
  const cfg = getFx9600Config();
  const appPort = overrides.appPort ?? cfg.appPort;
  const appToken = overrides.appToken ?? cfg.appToken;
  const candidates = buildReaderDiscoveryCandidates();

  const chunkSize = 18;
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    const probes = await Promise.all(
      chunk.map((ip) => probeUserAppAt(ip, appPort, appToken, overrides.timeoutMs ?? 900))
    );

    const authorized = probes.find((p) => p.ok);
    if (authorized) return { ip: authorized.ip, appPort, discovered: true, ...authorized };

    const needsRepair = probes.find((p) => p.reachable && (p.authError || p.status === 200));
    if (needsRepair) return { ip: needsRepair.ip, appPort, discovered: true, needsTokenRepair: true };
  }

  return null;
}

async function pushReaderPairingToUserApp(overrides = {}) {
  const cfg = getFx9600Config();
  if (!cfg.password) {
    return { ok: false, error: 'Contraseña FX9600 no configurada en la PC' };
  }

  const ip = overrides.ip ?? cfg.ip;
  const appPort = overrides.appPort ?? cfg.appPort;
  const portalWebhookUrl = resolvePortalWebhookUrl(ip);
  saveFx9600Config({ portalWebhookUrl });

  const apiToken = ensureAppToken();
  const { user, password } = cfg;

  try {
    const result = await callUserAppApi(
      'POST',
      '/api/credentials',
      { readerUser: user, readerPassword: password, apiToken, portalWebhookUrl },
      { timeoutMs: 20000, appToken: apiToken, ip, appPort }
    );
    return { ok: true, portalWebhookUrl, ...result };
  } catch (e) {
    if (!isUserAppTokenError(e)) throw e;
    await repairUserAppToken({ ip, appPort });
    return pushReaderCredentialsToUserApp();
  }
}

/**
 * Detecta lector, guarda IP/webhook y empuja credenciales + URL de alertas al FX9600.
 */
export async function ensureReaderPaired(overrides = {}) {
  const cfg = getFx9600Config();
  const appPort = overrides.appPort ?? cfg.appPort;
  let ip = overrides.ip ?? cfg.ip;

  let probe = ip ? await probeUserAppAt(ip, appPort, cfg.appToken) : { ok: false };
  if (!probe.ok) {
    const discovered = await discoverReaderOnNetwork({ appPort });
    if (!discovered) {
      return {
        ok: false,
        error: 'No se encontró el lector en la red. Verifique cable Ethernet y que la User App esté activa.',
      };
    }
    ip = discovered.ip;
    saveFx9600Config({ ip, appPort });
    probe = await probeUserAppAt(ip, appPort, cfg.appToken);
  }

  const portalWebhookUrl = resolvePortalWebhookUrl(ip);
  saveFx9600Config({ ip, appPort, portalWebhookUrl });

  if (overrides.password) {
    saveFx9600Config({ password: overrides.password, user: overrides.user });
  }

  let credentialsPush = { ok: false, skipped: true };
  if (getFx9600Config().password) {
    credentialsPush = await pushReaderPairingToUserApp({ ip, appPort });
  }

  const connected = await probeUserApp({ ip, appPort });
  let settingsApplied = { skipped: true };
  if (connected.ok || credentialsPush.ok) {
    try {
      const { ensureReaderSettingsApplied } = await import('./readerSettingsService.js');
      settingsApplied = await ensureReaderSettingsApplied();
    } catch (e) {
      settingsApplied = {
        ok: false,
        applied: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return {
    ok: connected.ok || credentialsPush.ok,
    ip,
    appPort,
    portalWebhookUrl,
    discovered: Boolean(overrides.discovered),
    credentialsPush,
    settingsApplied,
    connected: connected.ok,
    message: connected.ok
      ? `Lector conectado en ${ip}:${appPort}`
      : credentialsPush.ok
        ? `Lector emparejado en ${ip} (webhook ${portalWebhookUrl})`
        : 'Lector detectado pero falta contraseña admin para completar emparejamiento',
  };
}

export async function autoConnectReaderOnStartup() {
  const row = getDb().prepare("SELECT value FROM config WHERE key = 'demo_mode'").get();
  if (row?.value === 'true') return { skipped: 'demo' };
  const { password } = getFx9600Config();
  if (!password) return { skipped: 'no_password' };
  return ensureReaderPaired();
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

export function ensureAppToken() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('fx9600_app_token');
  if (row?.value) return row.value;
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(
    'fx9600_app_token',
    token
  );
  return token;
}

export function isUserAppTokenError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return msg.includes('token') || msg.includes('401');
}

/** Re-empareja el token PC ↔ lector (health OK pero /api/status falla). */
export async function repairUserAppToken(overrides = {}) {
  const apiToken = ensureAppToken();
  const { user, password } = getFx9600Config();
  const body = { apiToken, portalWebhookUrl: resolvePortalWebhookUrl(getFx9600Config().ip) };
  if (password) {
    body.readerUser = user;
    body.readerPassword = password;
  }
  return userAppRequest('POST', '/api/credentials', body, {
    timeoutMs: 15000,
    appToken: apiToken,
    ip: overrides.ip,
    appPort: overrides.appPort,
  });
}

export async function pushReaderCredentialsToUserApp() {
  const { user, password } = getFx9600Config();
  if (!password) {
    return { ok: false, error: 'Contraseña FX9600 no configurada en la PC' };
  }
  const apiToken = ensureAppToken();
  const portalWebhookUrl = resolvePortalWebhookUrl(getFx9600Config().ip);
  const result = await callUserAppApi(
    'POST',
    '/api/credentials',
    { readerUser: user, readerPassword: password, apiToken, portalWebhookUrl },
    { timeoutMs: 20000, appToken: apiToken }
  );
  return { ok: true, portalWebhookUrl, ...result };
}

export async function deployUserAppViaSsh(sshAuth = {}) {
  const { ip } = getFx9600Config();
  const pkgDir = join(process.cwd(), 'hardware', 'fx9600', 'pkg');
  const files = [
    'racketclub_gate.py',
    'RestAPI.py',
    'Logger.py',
    'INIFile.py',
    'AllowList.py',
    'Secrets.py',
    'UserAppServer.py',
    'config.ini',
    'start_racketclub-gate.sh',
    'stop_racketclub-gate.sh',
  ];

  const usePassword = Boolean(sshAuth.sshPassword);
  const sshOpts = {
    sshUser: sshAuth.sshUser,
    sshPassword: sshAuth.sshPassword,
    ip: sshAuth.ip || ip,
  };

  for (const name of files) {
    if (usePassword) {
      await scpUploadWithPassword(join(pkgDir, name), `/apps/${name}`, sshOpts);
    } else {
      await scpToReader(join(pkgDir, name), `/apps/${name}`);
    }
  }

  const postCmd =
    "sed -i 's/\\r$//' /apps/*.py /apps/*.sh /apps/config.ini 2>/dev/null; " +
    'chmod +x /apps/racketclub_gate.py /apps/*.sh 2>/dev/null; ' +
    'if [ ! -f /apps/.racketclub-gate-stopped ]; then ' +
    '/apps/stop_racketclub-gate.sh 2>/dev/null; sleep 2; ' +
    'nohup /apps/start_racketclub-gate.sh >>/tmp/racketclub-gate.log 2>&1 & sleep 3; ' +
    'fi; ' +
    'pgrep -f racketclub_gate.py || true; ' +
    'curl -s http://127.0.0.1:8765/api/health 2>/dev/null || true';

  if (usePassword) {
    await sshExecWithPassword(postCmd, sshOpts);
  } else {
    await sshExec(postCmd);
  }

  const health = await probeUserApp({ ip: sshOpts.ip });
  return {
    ok: true,
    ip: sshOpts.ip,
    appVersion: health.version,
    message: 'User App desplegada en /apps/',
    method: usePassword ? 'ssh-password' : 'ssh-key',
  };
}

function appSupportsLogStream(version) {
  const v = String(version || '');
  if (v.includes('1.0.6') || v.includes('1.0.7')) return true;
  const m = v.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  return major > 1 || (major === 1 && minor > 0) || (major === 1 && minor === 0 && patch >= 6);
}

export async function deployUserAppIfNeeded(sshAuth = {}) {
  const health = await probeUserApp({ ip: sshAuth.ip });
  const version = String(health.version || '');

  if (health.ok && appSupportsLogStream(version)) {
    return { ok: true, skipped: true, version, message: 'User App ya actualizada' };
  }

  const deployed = await deployUserAppViaSsh(sshAuth);
  return { ok: true, skipped: false, deployed, version: deployed.appVersion };
}

export async function syncAllowListViaSsh(payload) {
  const tmp = join(tmpdir(), `racketclub-allowlist-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  try {
    await scpToReader(tmp, '/apps/racketclub_allowlist.json');
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

  let health = null;
  try {
    health = await probeUserApp();
  } catch {
    health = { ok: false };
  }

  if (health?.ok && health.ip) {
    config.ip = health.ip;
  }

  try {
    const appStatus = await callUserAppApi('GET', '/api/status', null, { timeoutMs: 15000 });
    return {
      connected: true,
      reachable: true,
      appOk: true,
      appStatus,
      health,
      config,
    };
  } catch (e) {
    return {
      connected: Boolean(health?.ok),
      reachable: Boolean(health?.ok),
      appOk: false,
      appError: e.message,
      error: e.message,
      health,
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSshStopScript(sshAuth = {}) {
  // Inline kill: no matar stop_racketclub-gate.sh (el patrón "racketclub-gate" lo auto-mataba).
  const cmd = [
    'touch /apps/.racketclub-gate-stopped',
    'for pid in $(pgrep -f "racketclub_gate\\.py" 2>/dev/null); do',
    '  kill -TERM "$pid" 2>/dev/null || true',
    'done',
    'sleep 2',
    'for pid in $(pgrep -f "racketclub_gate\\.py" 2>/dev/null); do',
    '  kill -KILL "$pid" 2>/dev/null || true',
    'done',
    'fuser -k 8765/tcp 2>/dev/null || true',
    'rm -f /tmp/racketclub-gate.lock',
    '/apps/stop_racketclub-gate.sh 2>/dev/null || true',
    'pgrep -af "racketclub_gate\\.py" || echo STOPPED',
  ].join('; ');
  if (sshAuth.sshPassword) {
    return sshExecWithPassword(cmd, sshAuth);
  }
  try {
    return await sshExec(cmd);
  } catch {
    return '';
  }
}

async function runSshStartPrep(sshAuth = {}) {
  const cmd = 'rm -f /apps/.racketclub-gate-stopped 2>/dev/null; true';
  if (sshAuth.sshPassword) {
    return sshExecWithPassword(cmd, sshAuth);
  }
  try {
    return await sshExec(cmd);
  } catch {
    return '';
  }
}

async function listGateAppNames(token) {
  const names = new Set([getFx9600Config().appName || 'racketclub-gate']);
  try {
    const { json } = await fxRequest('GET', '/cloud/apps', { token });
    const raw = json?.message ?? json?.apps ?? json;
    const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
    for (const entry of list) {
      if (typeof entry === 'string') {
        if (/racketclub/i.test(entry)) names.add(entry);
        continue;
      }
      const name = entry?.name ?? entry?.appName ?? entry?.app ?? '';
      if (name && /racketclub/i.test(String(name))) names.add(String(name));
    }
  } catch {
    /* usar nombre configurado */
  }
  return [...names];
}

async function disableGateAutostart(token, appName) {
  const attempts = [{ autostart: false }, { autostart: 'false' }, { autoStart: false }];
  for (const body of attempts) {
    try {
      await fxRequest('PUT', `/cloud/apps/${encodeURIComponent(appName)}/autostart`, {
        token,
        body,
      });
      return true;
    } catch {
      /* siguiente formato */
    }
  }
  return false;
}

/**
 * Detiene racketclub-gate por completo: bandera stop, autostart off, API, Zebra y SSH.
 */
export async function stopGateApp(sshAuth = {}) {
  const steps = [];
  let cloudOk = false;

  try {
    await withToken(async (token) => {
      const appNames = await listGateAppNames(token);
      for (const name of appNames) {
        if (await disableGateAutostart(token, name)) {
          steps.push(`autostart-off:${name}`);
        }
      }
      cloudOk = true;
      for (const name of appNames) {
        try {
          await fxRequest('PUT', `/cloud/apps/${encodeURIComponent(name)}/stop`, { token, body: {} });
          steps.push(`cloud-stop:${name}`);
        } catch (e) {
          steps.push(`cloud-stop-error:${name}:${e.message}`);
        }
      }
      try {
        await fxRequest('PUT', '/cloud/stop', { token, body: {} });
        steps.push('inventory-stop');
      } catch (e) {
        steps.push(`inventory-stop-error:${e.message}`);
      }
    });
  } catch (e) {
    steps.push(`cloud-error:${e.message}`);
  }

  try {
    await callUserAppApi('POST', '/api/shutdown', {}, { timeoutMs: 5000, _noRepair: true });
    steps.push('user-app-shutdown');
  } catch {
    steps.push('user-app-shutdown-skipped');
  }

  await delay(1500);

  try {
    await runSshStopScript(sshAuth);
    steps.push('ssh-stop-script');
  } catch (e) {
    steps.push(`ssh-stop-error:${e.message}`);
  }

  await delay(2000);

  try {
    await runSshStopScript(sshAuth);
    steps.push('ssh-stop-retry');
  } catch {
    /* ignore */
  }

  await delay(1000);
  const health = await probeUserApp();
  const stillRunning = Boolean(health.ok);

  let message;
  if (!stillRunning) {
    message = 'User App detenida correctamente.';
  } else if (!cloudOk && !sshAuth.sshPassword) {
    message =
      'No se pudo detener: configure contraseña admin del lector y/o conecte el monitor con SSH (rfidadm).';
  } else if (stillRunning && !sshAuth.sshPassword) {
    message =
      'La User App sigue activa. Probable instancia huérfana: conecte el monitor con contraseña SSH y vuelva a Detener app.';
  } else {
    message =
      'La User App sigue respondiendo. En Zebra Applications desmarque AutoStart, Stop, y ejecute /apps/stop_racketclub-gate.sh por SSH.';
  }

  return {
    ok: !stillRunning,
    stopped: !stillRunning,
    stillRunning,
    steps,
    message,
  };
}

/** Inicia racketclub-gate vía consola Zebra; fallback SSH si hace falta. */
export async function startGateApp(sshAuth = {}, { enableAutostart = false } = {}) {
  const steps = [];

  try {
    await runSshStartPrep(sshAuth);
    steps.push('ssh-start-flag-cleared');
  } catch (e) {
    steps.push(`ssh-start-prep-error:${e.message}`);
  }

  try {
    await withToken(async (token) => {
      const appNames = await listGateAppNames(token);
      const primary = appNames[0] || getFx9600Config().appName || 'racketclub-gate';
      if (enableAutostart) {
        await fxRequest('PUT', `/cloud/apps/${encodeURIComponent(primary)}/autostart`, {
          token,
          body: { autostart: true },
        });
        steps.push('autostart-on');
      }
      await fxRequest('PUT', `/cloud/apps/${encodeURIComponent(primary)}/start`, { token, body: {} });
      steps.push(`cloud-start:${primary}`);
    });
  } catch (e) {
    steps.push(`cloud-start-error:${e.message}`);
  }

  await delay(3000);
  let health = await probeUserApp();
  if (!health.ok) {
    const startCmd =
      'rm -f /apps/.racketclub-gate-stopped 2>/dev/null; ' +
      'nohup /apps/start_racketclub-gate.sh >>/tmp/racketclub-gate.log 2>&1 & sleep 3; pgrep -f racketclub_gate.py || true';
    try {
      if (sshAuth.sshPassword) {
        await sshExecWithPassword(startCmd, sshAuth);
      } else {
        await sshExec(startCmd);
      }
      steps.push('ssh-start-fallback');
      await delay(3000);
      health = await probeUserApp();
    } catch (e) {
      steps.push(`ssh-start-error:${e.message}`);
    }
  }

  let paired = null;
  if (health.ok) {
    try {
      paired = await ensureReaderPaired();
      steps.push(paired?.ok ? 'credentials-pushed' : 'credentials-push-failed');
    } catch (e) {
      steps.push(`credentials-push-error:${e.message}`);
    }
  }

  return {
    ok: Boolean(health.ok),
    running: Boolean(health.ok),
    steps,
    version: health.version,
    portalWebhookUrl: paired?.portalWebhookUrl,
    message: health.ok
      ? `User App activa${health.version ? ` (v${health.version})` : ''}`
      : 'No se pudo iniciar la User App.',
  };
}

function userAppBaseUrl() {
  const { ip, appPort } = getFx9600Config();
  return `http://${ip}:${appPort}`;
}

function userAppRequest(method, apiPath, body = null, options = {}) {
  const cfg = getFx9600Config();
  const appToken = options.appToken ?? cfg.appToken;
  const hostname = options.ip ?? cfg.ip;
  const port = options.appPort ?? cfg.appPort;
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
  try {
    return await userAppRequest(method, apiPath, body, options);
  } catch (e) {
    if (
      options._noRepair ||
      apiPath === '/api/health' ||
      !isUserAppTokenError(e)
    ) {
      throw e;
    }
    await repairUserAppToken(options);
    return userAppRequest(method, apiPath, body, { ...options, _noRepair: true });
  }
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
    .map((r) => normalizeTid(r.tid))
    .filter(Boolean);
}

export async function syncFx9600(usuarioId = null) {
  const paired = await ensureReaderPaired();
  if (!paired.ok && !paired.connected) {
    throw new Error(paired.error || 'No se pudo conectar al lector FX9600');
  }

  const start = Date.now();
  const tids = getAuthorizedTids();
  const version =
    (getDb().prepare('SELECT COALESCE(MAX(version),0)+1 AS v FROM sync_log').get().v) || 1;

  const { gpoPin } = getFx9600Config();
  const apiToken = ensureAppToken();
  const portalWebhookUrl = resolvePortalWebhookUrl(getFx9600Config().ip);
  const steps = ['user-app-api', 'auto-pair'];
  const syncMethod = 'user-app-rest';

  const result = await callUserAppApi(
    'POST',
    '/api/sync',
    { tids, version, gpoPin, apiToken, portalWebhookUrl },
    { timeoutMs: 30000, appToken: apiToken }
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

  const compare = await fetchAllowListCompare();
  const cfgDb = getDb();
  cfgDb
    .prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
    .run('allowlist_reader_version', String(compare.reader.version ?? 0));
  cfgDb
    .prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
    .run('allowlist_reader_count', String(compare.reader.count ?? 0));

  let inventoryWarning;
  if (!compare.inSync) {
    inventoryWarning = `El lector aún no refleja la lista de la PC (${compare.onlyInReader.length} sobran, ${compare.onlyInDb.length} faltan). Reintentá sincronizar.`;
  }

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

  let readerSettingsApplied = { skipped: true };
  try {
    const { ensureReaderSettingsApplied } = await import('./readerSettingsService.js');
    readerSettingsApplied = await ensureReaderSettingsApplied();
  } catch (e) {
    readerSettingsApplied = {
      ok: false,
      applied: false,
      error: e instanceof Error ? e.message : String(e),
    };
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
    portalWebhookUrl,
    inventoryWarning,
    allowlist: compare,
    readerSettingsApplied,
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
      ? data.tids.map((t) => normalizeTid(t)).filter(Boolean)
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

export async function fetchMonitorStatus() {
  const ts = new Date().toISOString();
  const config = { ...getFx9600Config(), password: getFx9600Config().password ? '***' : '' };
  const reader = await fetchReaderStatusQuick();
  const process = await fetchAppProcess();
  const allowList = await fetchAllowListSummary();
  return { ts, config, process, allowList, reader };
}

export async function fetchMonitorSnapshot(logOffset = 0) {
  const status = await fetchMonitorStatus();
  const logs = await fetchAppLogChunk(logOffset);
  return {
    ...status,
    logs,
    logOffset: logs.size,
  };
}

export function saveFx9600Config({
  ip,
  user,
  password,
  appName,
  gpoPin,
  appPort,
  appToken,
  portalWebhookUrl,
  sshUser,
  sshPassword,
  clearSshPassword,
}) {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  if (ip != null) upsert.run('fx9600_ip', ip);
  if (user != null) upsert.run('fx9600_user', user);
  if (password != null && password !== '') upsert.run('fx9600_password', password);
  if (appName != null) upsert.run('fx9600_app_name', appName);
  if (gpoPin != null) upsert.run('fx9600_gpo_pin', String(gpoPin));
  if (appPort != null) upsert.run('fx9600_app_port', String(appPort));
  if (appToken != null && appToken !== '') upsert.run('fx9600_app_token', appToken);
  if (portalWebhookUrl != null) {
    const normalized = normalizePortalWebhookUrl(portalWebhookUrl);
    if (normalized !== null) upsert.run('portal_webhook_url', normalized);
  }
  if (sshUser != null) upsert.run('fx9600_ssh_user', sshUser);
  if (sshPassword != null && sshPassword !== '') upsert.run('fx9600_ssh_password', sshPassword);
  if (clearSshPassword) upsert.run('fx9600_ssh_password', '');
  cachedToken = null;
}

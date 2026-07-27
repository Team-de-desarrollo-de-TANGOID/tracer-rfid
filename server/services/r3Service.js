import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_PORT = Number(process.env.R3_BRIDGE_PORT) || 3848;
const BRIDGE_HOST = '127.0.0.1';

let child = null;
let starting = null;

function killBridgePort() {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${BRIDGE_PORT}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const pids = new Set();
      for (const line of result.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || !/LISTENING/i.test(trimmed)) continue;
        const parts = trimmed.split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0' && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
    } else {
      try {
        execSync(`lsof -ti :${BRIDGE_PORT} | xargs -r kill -9`, { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* port free */
  }
}

function projectRoot() {
  // server/services -> ../../
  return path.join(__dirname, '..', '..');
}

/** Ruta del bridge empaquetado o en desarrollo. */
export function getR3BridgeDir() {
  const env = process.env.RC_R3_BRIDGE_DIR;
  if (env && fs.existsSync(env)) return env;

  const candidates = [
    path.join(projectRoot(), 'hardware', 'r3-bridge'),
    path.join(process.resourcesPath || '', 'r3-bridge'),
    path.join(path.dirname(process.execPath || ''), 'resources', 'r3-bridge'),
    path.join(path.dirname(process.execPath || ''), 'r3-bridge'),
  ];
  for (const c of candidates) {
    if (
      c &&
      (fs.existsSync(path.join(c, 'dist', 'classes', 'com', 'tangoid', 'r3bridge', 'R3Bridge.class')) ||
        fs.existsSync(path.join(c, 'dist', 'r3-bridge.jar')) ||
        fs.existsSync(path.join(c, 'dist', 'r3-bridge-v2.jar')))
    ) {
      return c;
    }
  }
  return path.join(projectRoot(), 'hardware', 'r3-bridge');
}

function findJava() {
  if (process.env.JAVA_HOME) {
    const win = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    const nix = path.join(process.env.JAVA_HOME, 'bin', 'java');
    if (fs.existsSync(win)) return win;
    if (fs.existsSync(nix)) return nix;
  }
  const bundled = path.join(getR3BridgeDir(), 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (fs.existsSync(bundled)) return bundled;

  const common = [
    'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.12-hotspot\\bin\\java.exe',
    'C:\\Program Files\\Datacard\\jre\\bin\\java.exe',
  ];
  for (const p of common) {
    if (fs.existsSync(p)) return p;
  }
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

async function fetchBridge(pathname, { method = 'GET', body, timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${BRIDGE_HOST}:${BRIDGE_PORT}${pathname}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: text || `HTTP ${res.status}` };
    }
    return { ok: res.ok && data?.ok !== false, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

export async function isBridgeAlive() {
  try {
    const r = await fetchBridge('/health', { timeoutMs: 1500 });
    return Boolean(r.data?.ok);
  } catch {
    return false;
  }
}

function classpathFor(bridgeDir) {
  const sep = process.platform === 'win32' ? ';' : ':';
  // Prefer compiled classes (always fresh) over a possibly locked jar.
  const entries = [
    path.join(bridgeDir, 'dist', 'classes'),
    path.join(bridgeDir, 'dist', 'r3-bridge-v2.jar'),
    path.join(bridgeDir, 'dist', 'r3-bridge.jar'),
    path.join(bridgeDir, 'lib', 'ReaderAPI20250926.jar'),
    path.join(bridgeDir, 'lib', 'jna-5.4.0.jar'),
    path.join(bridgeDir, 'lib', 'jna-platform-5.4.0.jar'),
  ];
  return entries.filter((p) => fs.existsSync(p)).join(sep);
}

export async function ensureBridgeRunning() {
  // Healthy bridge already up → keep it (never kill/reconnect USB on poll).
  if (await isBridgeAlive()) {
    return { ok: true, already: true };
  }

  if (starting) return starting;

  starting = (async () => {
    // Re-check after waiting for another starter.
    if (await isBridgeAlive()) {
      return { ok: true, already: true };
    }

    const bridgeDir = getR3BridgeDir();
    const classesDir = path.join(bridgeDir, 'dist', 'classes');
    const jar = path.join(bridgeDir, 'dist', 'r3-bridge.jar');
    const jarV2 = path.join(bridgeDir, 'dist', 'r3-bridge-v2.jar');
    if (!fs.existsSync(classesDir) && !fs.existsSync(jar) && !fs.existsSync(jarV2)) {
      throw new Error(
        `No se encontró el bridge R3 en ${bridgeDir}. Compile hardware/r3-bridge (build.bat).`
      );
    }
    const java = findJava();
    const natives = path.join(bridgeDir, 'natives');
    const cp = classpathFor(bridgeDir);

    // Only clear the port if nothing healthy answered (stale listener).
    killBridgePort();
    await new Promise((r) => setTimeout(r, 300));

    if (child) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      child = null;
    }

    child = spawn(
      java,
      [
        `-Djava.library.path=${natives}`,
        '-cp',
        cp,
        'com.tangoid.r3bridge.R3Bridge',
        '--port',
        String(BRIDGE_PORT),
        '--natives',
        natives,
      ],
      {
        cwd: bridgeDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PATH: `${natives}${path.delimiter}${process.env.PATH || ''}`,
        },
      }
    );

    child.stdout?.on('data', (d) => console.log(`[R3Bridge] ${String(d).trim()}`));
    child.stderr?.on('data', (d) => console.error(`[R3Bridge] ${String(d).trim()}`));
    child.on('exit', (code) => {
      console.log(`[R3Bridge] proceso finalizado (${code})`);
      if (child?.pid) {
        /* keep reference cleared only if same process */
      }
      child = null;
    });
    child.on('error', (err) => {
      console.error('[R3Bridge] no se pudo iniciar Java:', err.message);
      child = null;
    });

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await isBridgeAlive()) return { ok: true, started: true };
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(
      'El bridge R3 no respondió. Verifique que Java 17+ esté instalado y el lector USB conectado.'
    );
  })().finally(() => {
    starting = null;
  });

  return starting;
}

export function stopBridge() {
  if (child) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    child = null;
  }
  killBridgePort();
}

function getSavedPower() {
  const row = getDb().prepare("SELECT value FROM config WHERE key = 'r3_power'").get();
  if (!row?.value) return { ant1: 15, ant2: 15, ant3: 15, ant4: 15 };
  try {
    const parsed = JSON.parse(row.value);
    return {
      ant1: clamp(parsed.ant1 ?? parsed.power ?? 15),
      ant2: clamp(parsed.ant2 ?? parsed.power ?? 15),
      ant3: clamp(parsed.ant3 ?? parsed.power ?? 15),
      ant4: clamp(parsed.ant4 ?? parsed.power ?? 15),
    };
  } catch {
    return { ant1: 15, ant2: 15, ant3: 15, ant4: 15 };
  }
}

function savePower(power) {
  getDb()
    .prepare(
      `INSERT INTO config (key, value) VALUES ('r3_power', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(JSON.stringify(power));
}

function clamp(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 15;
  return Math.min(30, Math.max(1, Math.round(v)));
}

export async function getR3Status() {
  let bridgeOk = false;
  let bridgeError = null;
  try {
    await ensureBridgeRunning();
    bridgeOk = true;
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
  }

  if (!bridgeOk) {
    return {
      ok: false,
      bridge: false,
      connected: false,
      inventory: false,
      state: 'BRIDGE_OFFLINE',
      lastError: bridgeError,
      power: getSavedPower(),
      javaRequired: true,
    };
  }

  const r = await fetchBridge('/status');
  const data = r.data || {};
  return {
    ok: true,
    bridge: true,
    connected: Boolean(data.connected),
    inventory: Boolean(data.inventory),
    state: data.state || (data.connected ? 'CONNECTED' : 'DISCONNECTED'),
    lastError: data.lastError || null,
    power: data.power || getSavedPower(),
    tagCount: data.tagCount ?? 0,
    cursor: data.cursor ?? 0,
  };
}

let connectFlight = null;
let inventoryFlight = null;

export async function connectR3() {
  if (connectFlight) return connectFlight;
  connectFlight = (async () => {
    await ensureBridgeRunning();
    // Store desired power in bridge memory first (no USB yet if disconnected).
    const power = getSavedPower();
    await fetchBridge('/power', { method: 'POST', body: power, timeoutMs: 5000 }).catch(() => null);
    const r = await fetchBridge('/connect', { method: 'POST', timeoutMs: 25000 });
    if (!r.ok) {
      throw new Error(r.data?.error || 'No se pudo conectar al lector R3');
    }
    return getR3Status();
  })().finally(() => {
    connectFlight = null;
  });
  return connectFlight;
}

export async function startInventory() {
  if (inventoryFlight) return inventoryFlight;
  inventoryFlight = (async () => {
    await ensureBridgeRunning();
    let status = await getR3Status();
    if (!status.connected) {
      await connectR3();
      status = await getR3Status();
    }
    // Already inventoring — do not POST /power (that stops/restarts and can freeze UI).
    if (status.inventory) {
      return getR3Status();
    }
    const power = getSavedPower();
    await fetchBridge('/power', { method: 'POST', body: power, timeoutMs: 8000 }).catch(() => null);
    const r = await fetchBridge('/inventory/start', { method: 'POST', timeoutMs: 20000 });
    if (!r.ok) throw new Error(r.data?.error || 'No se pudo iniciar la lectura');
    return getR3Status();
  })().finally(() => {
    inventoryFlight = null;
  });
  return inventoryFlight;
}

export async function disconnectR3() {
  if (!(await isBridgeAlive())) {
    return {
      ok: true,
      bridge: false,
      connected: false,
      inventory: false,
      state: 'DISCONNECTED',
      power: getSavedPower(),
    };
  }
  // Longer timeout: bridge stops inventory, clears callbacks and frees USB.
  await fetchBridge('/disconnect', { method: 'POST', timeoutMs: 15000 });
  return getR3Status();
}

export async function stopInventory() {
  if (!(await isBridgeAlive())) return getR3Status();
  await fetchBridge('/inventory/stop', { method: 'POST' });
  return getR3Status();
}

export async function getTags(since = 0) {
  await ensureBridgeRunning();
  const r = await fetchBridge(`/tags?since=${Number(since) || 0}`);
  if (!r.ok) throw new Error(r.data?.error || 'Error al leer tags');
  return r.data;
}

export async function clearTags() {
  if (!(await isBridgeAlive())) return { ok: true };
  return (await fetchBridge('/tags/clear', { method: 'POST' })).data;
}

/** Allow previously reported TID(s) to be read again. */
export async function forgetTags(tids = []) {
  const list = (Array.isArray(tids) ? tids : [tids])
    .map((t) => String(t || '').trim().toUpperCase())
    .filter(Boolean);
  if (!list.length) return { ok: true, forgotten: 0 };
  if (!(await isBridgeAlive())) return { ok: true, forgotten: 0 };
  const body = list.length === 1 ? { tid: list[0] } : { tids: list };
  const r = await fetchBridge('/tags/forget', { method: 'POST', body, timeoutMs: 5000 });
  if (!r.ok) throw new Error(r.data?.error || 'No se pudo olvidar el tag');
  return r.data;
}

export async function setPower(body = {}) {
  await ensureBridgeRunning();
  const current = getSavedPower();
  let next;
  if (body.power != null) {
    const p = clamp(body.power);
    next = { ant1: p, ant2: p, ant3: p, ant4: p };
  } else {
    next = {
      ant1: body.ant1 != null ? clamp(body.ant1) : current.ant1,
      ant2: body.ant2 != null ? clamp(body.ant2) : current.ant2,
      ant3: body.ant3 != null ? clamp(body.ant3) : current.ant3,
      ant4: body.ant4 != null ? clamp(body.ant4) : current.ant4,
    };
  }
  savePower(next);
  const r = await fetchBridge('/power', { method: 'POST', body: next, timeoutMs: 20000 });
  if (!r.ok) throw new Error(r.data?.error || 'No se pudo aplicar la potencia');
  // Prefer a fresh status so lastError / inventory flags stay in sync.
  const status = await getR3Status().catch(() => null);
  return {
    ok: true,
    power: status?.power || r.data?.power || next,
    connected: Boolean(status?.connected ?? r.data?.connected),
    inventory: Boolean(status?.inventory),
    lastError: status?.lastError ?? null,
  };
}

export async function getPower() {
  const saved = getSavedPower();
  if (!(await isBridgeAlive())) {
    return { ok: true, power: saved, min: 1, max: 30, connected: false };
  }
  const r = await fetchBridge('/power');
  return {
    ok: true,
    power: r.data?.power || saved,
    min: 1,
    max: 30,
    connected: Boolean(r.data?.connected),
  };
}

process.on('exit', () => stopBridge());
process.on('SIGINT', () => {
  stopBridge();
});
process.on('SIGTERM', () => {
  stopBridge();
});

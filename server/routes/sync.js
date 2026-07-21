import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  syncFx9600,
  getReaderStatus,
  saveFx9600Config,
  getFx9600Config,
  testGpo,
  deployUserAppViaSsh,
  deployUserAppIfNeeded,
  fetchMonitorSnapshot,
  fetchMonitorStatus,
  fetchAllowListCompare,
  ensureReaderPaired,
  resolvePortalWebhookUrl,
  stopGateApp,
  startGateApp,
} from '../services/fx9600Service.js';
import { pipeReaderLogs } from '../services/readerLogStream.js';
import { setMonitorSession, getMonitorSession, clearMonitorSession } from '../services/monitorSession.js';
import {
  getReaderSettings,
  applyReaderSettings,
  getPortalUiSettings,
} from '../services/readerSettingsService.js';

const router = Router();

router.use(authMiddleware);

let lastBackgroundPairAttempt = 0;

function isDemoMode() {
  const row = getDb().prepare("SELECT value FROM config WHERE key = 'demo_mode'").get();
  return row?.value === 'true';
}

router.get('/status', requirePermission('sync.ver_historial', 'sync.ejecutar'), async (_req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ demo: true, connected: false, message: 'Modo demo activo' });
    }
    let data = await getReaderStatus();

    if (!data.appOk && getFx9600Config().password && Date.now() - lastBackgroundPairAttempt > 45_000) {
      lastBackgroundPairAttempt = Date.now();
      ensureReaderPaired().catch(() => {});
    }

    if (!data.appOk) {
      data = await getReaderStatus();
    }

    const cfg = getFx9600Config();
    res.json({
      demo: false,
      connected: Boolean(data.appOk),
      reachable: Boolean(data.reachable ?? data.health?.ok),
      appAuthenticated: Boolean(data.appOk),
      error: data.appOk ? undefined : data.appError ?? 'User App API sin respuesta',
      portalWebhookUrl: resolvePortalWebhookUrl(cfg.ip),
      ...data,
    });
  } catch (e) {
    res.status(502).json({
      demo: false,
      connected: false,
      error: e.message,
      config: getFx9600Config(),
    });
  }
});

router.post('/auto-connect', requirePermission('sync.ejecutar'), async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ ok: false, demo: true, message: 'Modo demo activo' });
    }
    const { password, user } = req.body ?? {};
    if (password) {
      saveFx9600Config({ password, user });
    }
    const result = await ensureReaderPaired({ password, user });
    res.json(result);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.put('/config', requirePermission('sync.ejecutar'), async (req, res) => {
  const { ip, user, password, appName, gpoPin, appPort, appToken } = req.body ?? {};
  saveFx9600Config({ ip, user, password, appName, gpoPin, appPort, appToken });
  let credentialsPush;
  if (!isDemoMode()) {
    try {
      const paired = await ensureReaderPaired({ ip, user, password });
      credentialsPush = paired.credentialsPush;
    } catch (e) {
      credentialsPush = { ok: false, error: e.message };
    }
  }
  const cfg = getFx9600Config();
  res.json({
    ok: true,
    config: { ...cfg, password: cfg.password ? '***' : '' },
    credentialsPush,
    portalWebhookUrl: resolvePortalWebhookUrl(cfg.ip),
  });
});

router.post('/deploy', requirePermission('sync.ejecutar'), async (_req, res) => {
  try {
    const result = await deployUserAppViaSsh();
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/probe', requirePermission('sync.ejecutar'), async (req, res) => {
  try {
    const { ip, appPort, user, password } = req.body ?? {};
    if (password) saveFx9600Config({ password, user });
    if (ip) saveFx9600Config({ ip, appPort });
    const result = await ensureReaderPaired({ ip, appPort, user, password });
    res.json(result);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.post('/app/stop', requirePermission('sync.control_app', 'sync.ejecutar'), async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ ok: false, demo: true, message: 'Modo demo activo' });
    }
    const cfg = getFx9600Config();
    const session = getMonitorSession(req.user.id);
    const sshAuth = {
      sshUser: req.body?.sshUser || session?.sshUser || cfg.sshUser,
      sshPassword: req.body?.sshPassword || session?.sshPassword,
      ip: session?.ip || cfg.ip,
    };
    if (req.body?.adminPassword) {
      saveFx9600Config({ password: req.body.adminPassword, user: req.body?.adminUser });
    }
    const result = await stopGateApp(sshAuth);
    res.json(result);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.post('/app/start', requirePermission('sync.control_app', 'sync.ejecutar'), async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ ok: false, demo: true, message: 'Modo demo activo' });
    }
    const cfg = getFx9600Config();
    const session = getMonitorSession(req.user.id);
    const sshAuth = {
      sshUser: req.body?.sshUser || session?.sshUser || cfg.sshUser,
      sshPassword: req.body?.sshPassword || session?.sshPassword,
      ip: session?.ip || cfg.ip,
    };
    const enableAutostart = Boolean(req.body?.enableAutostart);
    const result = await startGateApp(sshAuth, { enableAutostart });
    res.json(result);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.get('/reader-settings', requirePermission('sync.ejecutar', 'sync.ver_historial'), async (_req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ demo: true, settings: { seenTimeoutSec: 5 } });
    }
    const data = await getReaderSettings();
    res.json({ demo: false, ...data });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** Preferencias de alertas en la web (solo PC, sin consultar al lector). */
router.get('/portal-ui-settings', requirePermission('dashboard.ver', 'sync.ver_historial'), (_req, res) => {
  res.json(getPortalUiSettings());
});

router.put('/reader-settings', requirePermission('sync.ejecutar'), async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ ok: false, demo: true, message: 'Modo demo activo' });
    }
    const result = await applyReaderSettings(req.body ?? {});
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/test-gpo', requirePermission('sync.ejecutar'), async (req, res) => {
  try {
    const cfg = getFx9600Config();
    const pin = Number(req.body?.pin ?? cfg.gpoPin);
    const state = req.body?.state !== false;
    await testGpo(pin, state);
    res.json({
      ok: true,
      pin,
      state,
      message: state ? `GPO ${pin} activado` : `GPO ${pin} desactivado`,
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.post('/', requirePermission('sync.ejecutar'), async (req, res) => {
  try {
    const result = await syncFx9600(req.user?.id);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get('/allowlist', requirePermission('sync.ver_historial', 'sync.ejecutar'), async (_req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ demo: true, message: 'Modo demo activo' });
    }
    const data = await fetchAllowListCompare();
    res.json({ demo: false, ...data });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get('/history', requirePermission('sync.ver_historial', 'sync.ejecutar'), (_req, res) => {
  res.json(
    getDb().prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 20').all()
  );
});

const MONITOR_PERMS = requirePermission('sync.ver_historial', 'sync.ejecutar');

router.get('/monitor/snapshot', MONITOR_PERMS, async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({
        demo: true,
        ts: new Date().toISOString(),
        message: 'Modo demo: conecte un FX9600 real para ver el monitor.',
      });
    }
    const offset = Number.parseInt(req.query.offset ?? '0', 10) || 0;
    const snapshot = await fetchMonitorSnapshot(offset);
    res.json({ demo: false, ...snapshot });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/monitor/connect', MONITOR_PERMS, async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ ok: false, demo: true, message: 'Modo demo activo' });
    }

    const { sshUser, sshPassword, adminUser, adminPassword } = req.body ?? {};
    if (!sshPassword?.trim()) {
      return res.status(400).json({ ok: false, error: 'La contraseña SSH es obligatoria.' });
    }

    const cfg = getFx9600Config();
    const effectiveAdminPassword = adminPassword?.trim() || cfg.password;
    if (!effectiveAdminPassword) {
      return res.status(400).json({
        ok: false,
        error: 'La contraseña admin del lector es obligatoria (o guárdela en configuración).',
      });
    }

    saveFx9600Config({
      user: adminUser || cfg.user || 'admin',
      password: effectiveAdminPassword,
    });

    const paired = await ensureReaderPaired({
      user: adminUser || cfg.user,
      password: effectiveAdminPassword,
    });

    const deploy = await deployUserAppIfNeeded({
      sshUser: sshUser || 'rfidadm',
      sshPassword,
      ip: paired.ip,
    });

    await ensureReaderPaired({ ip: paired.ip });

    setMonitorSession(req.user.id, {
      sshUser: sshUser || 'rfidadm',
      sshPassword,
      adminUser: adminUser || 'admin',
      ip: paired.ip,
    });

    const status = await getReaderStatus();

    res.json({
      ok: true,
      paired,
      deploy,
      ip: paired.ip,
      appOk: status.appOk,
      reachable: status.reachable,
      appVersion: status.health?.version ?? deploy.version,
      message: 'Conectado. El monitor en vivo está listo.',
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.post('/monitor/disconnect', MONITOR_PERMS, (req, res) => {
  clearMonitorSession(req.user.id);
  res.json({ ok: true });
});

router.get('/monitor/stream', MONITOR_PERMS, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  const abort = new AbortController();

  req.on('close', () => {
    closed = true;
    abort.abort();
  });

  const send = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (isDemoMode()) {
    send('meta', { source: 'demo', mode: 'simulado' });
    const timer = setInterval(() => {
      if (closed) {
        clearInterval(timer);
        return;
      }
      send('log', {
        lines: `[${new Date().toLocaleTimeString('es-AR')}] demo — sin lector conectado`,
      });
    }, 3000);
    req.on('close', () => clearInterval(timer));
    return;
  }

  const pushStatus = async () => {
    if (closed) return;
    try {
      const status = await fetchMonitorStatus();
      send('status', { demo: false, ...status });
    } catch (e) {
      send('error', { message: e.message, ts: new Date().toISOString() });
    }
  };

  await pushStatus();
  const statusTimer = setInterval(() => {
    if (closed) clearInterval(statusTimer);
    else pushStatus();
  }, 8000);

  const session = getMonitorSession(req.user.id);
  if (!session) {
    send('error', {
      message: 'Ingrese credenciales SSH y pulse Conectar antes de abrir el monitor.',
      ts: new Date().toISOString(),
    });
    req.on('close', () => clearInterval(statusTimer));
    return;
  }

  send('meta', { source: 'connecting', message: 'Abriendo terminal en vivo…' });

  const onLogEvent = (event, data) => {
    if (closed) return;
    if (event === 'ping') return;
    send(event, data);
  };

  pipeReaderLogs({
    tail: 150,
    signal: abort.signal,
    sshAuth: session,
    onEvent: onLogEvent,
    onError: (msg) => send('error', { message: msg, ts: new Date().toISOString() }),
  }).then((stream) => {
    if (closed) stream?.close?.();
    else if (stream?.ok) {
      send('meta', {
        source: stream.source,
        mode: stream.source === 'ssh' ? 'SSH tail -f' : 'User App tail -f',
        live: true,
      });
    }
  });

  req.on('close', () => clearInterval(statusTimer));
});

export default router;

import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  syncFx9600,
  getReaderStatus,
  saveFx9600Config,
  getFx9600Config,
  probeUserApp,
  testGpo,
  deployUserAppViaSsh,
  fetchMonitorSnapshot,
  fetchAllowListCompare,
  pushReaderCredentialsToUserApp,
} from '../services/fx9600Service.js';

const router = Router();

router.use(authMiddleware);

function isDemoMode() {
  const row = getDb().prepare("SELECT value FROM config WHERE key = 'demo_mode'").get();
  return row?.value === 'true';
}

router.get('/status', requirePermission('sync.ver_historial', 'sync.ejecutar'), async (_req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ demo: true, connected: false, message: 'Modo demo activo' });
    }
    const data = await getReaderStatus();
    res.json({
      demo: false,
      connected: Boolean(data.appOk),
      error: data.appOk ? undefined : data.appError ?? 'User App API sin respuesta',
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

router.put('/config', requirePermission('sync.ejecutar'), async (req, res) => {
  const { ip, user, password, appName, gpoPin, appPort } = req.body ?? {};
  saveFx9600Config({ ip, user, password, appName, gpoPin, appPort });
  let credentialsPush;
  if (!isDemoMode()) {
    try {
      credentialsPush = await pushReaderCredentialsToUserApp();
    } catch (e) {
      credentialsPush = { ok: false, error: e.message };
    }
  }
  const cfg = getFx9600Config();
  res.json({
    ok: true,
    config: { ...cfg, password: cfg.password ? '***' : '' },
    credentialsPush,
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
    const cfg = getFx9600Config();
    const resolvedIp = ip || cfg.ip;
    const resolvedPort = appPort != null ? Number(appPort) : cfg.appPort;
    saveFx9600Config({
      ip: resolvedIp,
      appPort: resolvedPort,
      user,
      password: password ?? undefined,
    });
    const result = await probeUserApp({ ip: resolvedIp, appPort: resolvedPort });
    let credentialsPush;
    const cfgAfter = getFx9600Config();
    if (cfgAfter.password) {
      try {
        credentialsPush = await pushReaderCredentialsToUserApp();
      } catch (e) {
        credentialsPush = { ok: false, error: e.message };
      }
    }
    res.json({ ...result, credentialsPush });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.post('/test-gpo', requirePermission('sync.ejecutar'), async (req, res) => {
  try {
    const cfg = getFx9600Config();
    const pin = Number(req.body?.pin ?? cfg.gpoPin);
    await testGpo(pin, true);
    res.json({ ok: true, pin, message: `GPO ${pin} activado` });
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

router.get('/monitor/stream', MONITOR_PERMS, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  let logOffset = Number.parseInt(req.query.offset ?? '0', 10) || 0;
  const intervalMs = Math.min(
    10000,
    Math.max(1500, Number.parseInt(req.query.interval ?? '2500', 10) || 2500)
  );

  req.on('close', () => {
    closed = true;
  });

  const send = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (isDemoMode()) {
    send('snapshot', {
      demo: true,
      ts: new Date().toISOString(),
      message: 'Modo demo activo',
    });
    const timer = setInterval(() => {
      if (closed) {
        clearInterval(timer);
        return;
      }
      send('snapshot', {
        demo: true,
        ts: new Date().toISOString(),
        logs: { lines: `[demo] ${new Date().toLocaleTimeString('es-AR')} — sin lector conectado\n` },
      });
    }, 3000);
    req.on('close', () => clearInterval(timer));
    return;
  }

  const poll = async () => {
    while (!closed) {
      try {
        const snapshot = await fetchMonitorSnapshot(logOffset);
        logOffset = snapshot.logOffset ?? logOffset;
        send('snapshot', { demo: false, ...snapshot });
      } catch (e) {
        send('error', { message: e.message, ts: new Date().toISOString() });
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  poll();
});

export default router;

import { Router } from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { getDashboardData, resolveDashboardRange } from '../services/dashboardService.js';
import { deleteDeteccionesInRange } from '../services/portalEventosService.js';
import { listDetecciones } from '../services/portalEventosService.js';
import { subscribePortalAlerts } from '../services/portalIngestService.js';
import { formatInstantInAppTz, nowInAppTz } from '../utils/appTimezone.js';

const router = Router();
const DASHBOARD_PERMS = requirePermission('dashboard.ver');

router.use(authMiddleware);

router.get('/', DASHBOARD_PERMS, (req, res) => {
  const { period, from, to } = req.query;
  res.json(getDashboardData({ period, from, to }));
});

router.post(
  '/reset-detecciones',
  requirePermission('dashboard.reiniciar_contador'),
  (req, res) => {
    const { period, from, to } = req.body ?? {};
    const range = resolveDashboardRange(period, from, to);
    const deleted = deleteDeteccionesInRange({
      from: range.from,
      to: range.to,
      tipo: 'SALIDA_DENEGADA',
    });
    res.json({
      ok: true,
      deleted,
      range,
      message: `Se reinició el contador del período (${deleted} registro${deleted === 1 ? '' : 's'} eliminados).`,
    });
  }
);

router.get('/detecciones', DASHBOARD_PERMS, (req, res) => {
  const { period, from, to, limit, offset } = req.query;
  const range = resolveDashboardRange(period, from, to);
  const items = listDetecciones({
    from: range.from,
    to: range.to,
    limit: Math.min(Number(limit) || 200, 500),
    offset: Number(offset) || 0,
  });
  res.json({ range, items });
});

router.get('/alerts/stream', requirePermission('dashboard.alertas', 'dashboard.ver'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  const send = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('ready', { ok: true, ts: new Date().toISOString() });

  // Catch-up al conectar/reconectar (misma zona BA que portal_detecciones).
  const sinceParam = req.query.since ? String(req.query.since) : null;
  const cutoffMs = 5 * 60_000;
  const since =
    sinceParam || formatInstantInAppTz(new Date(Date.now() - cutoffMs)) || nowInAppTz();

  try {
    const recent = listDetecciones({
      from: since,
      to: nowInAppTz(),
      limit: 50,
    });
    if (recent.length > 0) {
      send('alert', {
        kind: recent.length > 1 ? 'denied_batch' : 'denied',
        count: recent.length,
        detecciones: recent,
        deteccion: recent[0],
        replay: true,
      });
    }
  } catch (e) {
    console.warn('[Dashboard] replay error:', e.message);
  }

  const unsubscribe = subscribePortalAlerts(res);

  req.on('close', () => {
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
  });

  const heartbeat = setInterval(() => {
    if (closed) {
      clearInterval(heartbeat);
      return;
    }
    send('ping', { ts: new Date().toISOString() });
  }, 15000);
});

export default router;

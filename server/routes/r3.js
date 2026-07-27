import { Router } from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  clearTags,
  connectR3,
  disconnectR3,
  forgetTags,
  getPower,
  getR3Status,
  getTags,
  setPower,
  startInventory,
  stopInventory,
} from '../services/r3Service.js';

const router = Router();
router.use(authMiddleware);

const canAlta = requirePermission('activos.crear');

router.get('/status', canAlta, async (_req, res) => {
  try {
    res.json(await getR3Status());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/connect', canAlta, async (_req, res) => {
  try {
    res.json(await connectR3());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/disconnect', canAlta, async (_req, res) => {
  try {
    res.json(await disconnectR3());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/inventory/start', canAlta, async (_req, res) => {
  try {
    res.json(await startInventory());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/inventory/stop', canAlta, async (_req, res) => {
  try {
    res.json(await stopInventory());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/tags', canAlta, async (req, res) => {
  try {
    const since = Number(req.query.since) || 0;
    res.json(await getTags(since));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/tags/clear', canAlta, async (_req, res) => {
  try {
    res.json(await clearTags());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/tags/forget', canAlta, async (req, res) => {
  try {
    const body = req.body || {};
    const tids = body.tids || (body.tid != null ? [body.tid] : []);
    res.json(await forgetTags(tids));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/power', canAlta, async (_req, res) => {
  try {
    res.json(await getPower());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/power', canAlta, async (req, res) => {
  try {
    res.json(await setPower(req.body || {}));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { simulateFx9600Sync } from '../services/mockReader.js';

const router = Router();

router.use(authMiddleware);

router.post('/', requirePermission('sync.ejecutar'), async (req, res) => {
  try {
    const result = await simulateFx9600Sync(req.user?.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', requirePermission('sync.ver_historial', 'sync.ejecutar'), (_req, res) => {
  res.json(
    getDb().prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 20').all()
  );
});

export default router;

import { Router } from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { simulateTagBatch, simulateSingleTid, simulateNewTagBatch } from '../services/mockReader.js';

const router = Router();

router.use(authMiddleware);

router.post('/scan-one', requirePermission('activos.crear'), (_req, res) => {
  const tid = simulateSingleTid();
  res.json({ tid, epc: tid, demo: true, device: 'R3 (simulado)' });
});

router.post('/scan-batch', requirePermission('activos.crear'), (req, res) => {
  const count = Math.min(Number(req.body?.count) || 12, 200);
  const tids = simulateNewTagBatch(count);
  res.json({ tids, epcs: tids, total: tids.length, demo: true, device: 'R3 (simulado)' });
});

export default router;

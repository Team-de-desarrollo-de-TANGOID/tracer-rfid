import { Router } from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { simulateTagBatch, simulateSingleTid, simulateNewTagBatch, simulateAuditRead } from '../services/mockReader.js';
import { enrichAuditTids, saveAuditoria } from '../services/auditoriasService.js';

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

router.post('/audit/scan-one', requirePermission('auditoria.ejecutar'), (_req, res) => {
  const tid = simulateAuditRead();
  res.json({ tid, demo: true, device: 'R3 (simulado)' });
});

function saveAuditRecord(enriched, usuarioId, fechaInicio) {
  return saveAuditoria({
    tids: enriched.map((t) => t.tid),
    usuarioId,
    fechaInicio,
  });
}

router.post('/audit/complete', requirePermission('auditoria.ejecutar'), (req, res) => {
  const { tids, fechaInicio } = req.body ?? {};
  if (!Array.isArray(tids) || tids.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un TID leído.' });
  }

  const enriched = enrichAuditTids(tids);
  const { id: auditId, registrados, desconocidos } = saveAuditRecord(
    enriched,
    req.user.id,
    fechaInicio
  );

  res.json({
    id: auditId,
    tags: enriched,
    total: enriched.length,
    registrados,
    desconocidos,
    demo: true,
    device: 'R3 (simulado)',
  });
});

router.post('/audit', requirePermission('auditoria.ejecutar'), (req, res) => {
  const count = Math.min(Number(req.body?.count) || 15, 200);
  const tags = simulateTagBatch(count);
  const enriched = enrichAuditTids(tags);
  const { id: auditId, registrados, desconocidos } = saveAuditRecord(enriched, req.user.id);

  res.json({
    id: auditId,
    tags: enriched,
    total: enriched.length,
    registrados,
    desconocidos,
    demo: true,
    device: 'R3 (simulado)',
  });
});

export default router;

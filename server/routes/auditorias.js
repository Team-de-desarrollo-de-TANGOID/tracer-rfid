import { Router } from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { getAuditoriaById, listAuditorias, saveAuditoria } from '../services/auditoriasService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('auditoria.ejecutar', 'auditoria.ver_historial'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(listAuditorias({ limit }));
});

router.get('/:id', requirePermission('auditoria.ejecutar', 'auditoria.ver_historial'), (req, res) => {
  const audit = getAuditoriaById(Number(req.params.id));
  if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada.' });
  res.json(audit);
});

router.post('/', requirePermission('auditoria.ejecutar'), (req, res) => {
  const { tids, fechaInicio, notas } = req.body ?? {};
  if (!Array.isArray(tids) || tids.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un TID leído.' });
  }
  try {
    const result = saveAuditoria({
      tids,
      usuarioId: req.user.id,
      fechaInicio,
      notas,
    });
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

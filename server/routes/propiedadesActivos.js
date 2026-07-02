import { Router } from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  createPropiedad,
  deletePropiedad,
  listPropiedades,
  updatePropiedad,
} from '../services/propiedadesService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('config.propiedades'), (_req, res) => {
  res.json(listPropiedades({ includeOcultas: true, withUsage: true }));
});

router.post('/', requirePermission('config.propiedades'), (req, res) => {
  try {
    const { etiqueta, tipo, editable, visibleDefault, obligatoriaAlta, listaOpciones, listaMultiple } =
      req.body ?? {};
    const created = createPropiedad({
      etiqueta,
      tipo,
      editable,
      visibleDefault,
      obligatoriaAlta,
      listaOpciones,
      listaMultiple,
      creadoPorUsuarioId: req.user?.id ?? null,
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/:id', requirePermission('config.propiedades'), (req, res) => {
  try {
    const updated = updatePropiedad(Number(req.params.id), req.body ?? {});
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('config.propiedades'), (req, res) => {
  try {
    res.json(deletePropiedad(Number(req.params.id)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

import { Router } from 'express';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  getInventarioConfig,
  savePreferenciasInventario,
} from '../services/preferenciasService.js';

const router = Router();

router.use(authMiddleware);

router.get('/inventario-columnas', requirePermission('inventario.ver'), (req, res) => {
  res.json(getInventarioConfig(req.user.id));
});

router.put('/inventario-columnas', requirePermission('inventario.columnas'), (req, res) => {
  const { columnas } = req.body ?? {};
  if (!Array.isArray(columnas)) {
    return res.status(400).json({ error: 'Se requiere un array de columnas.' });
  }
  try {
    const visibles = savePreferenciasInventario(req.user.id, columnas);
    res.json(getInventarioConfig(req.user.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

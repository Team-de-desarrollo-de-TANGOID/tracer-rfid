import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { activoSelect, mapActivo, getActivoById } from '../services/activosService.js';
import { registrarEvento, getHistorialActivo } from '../services/eventosService.js';
import { mergePropiedadesExtra, listPropiedades, validateCamposObligatoriosAlta } from '../services/propiedadesService.js';
import {
  esEstadoDeBaja,
  estadoEstaHabilitado,
} from '../constants/estadoOperativo.js';

const router = Router();

router.use(authMiddleware);

function sanitizePropiedadesExtraForCreate(input) {
  if (!input || typeof input !== 'object') return '{}';
  const customCols = listPropiedades({ includeOcultas: true }).filter((c) => c.esCustom);
  const allowed = new Set(customCols.map((c) => c.codigo));
  const patch = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowed.has(key) && value != null && String(value).trim() !== '') {
      patch[key] = String(value);
    }
  }
  return mergePropiedadesExtra('{}', patch);
}

router.get('/propiedades-alta', requirePermission('activos.crear', 'inventario.ver'), (_req, res) => {
  res.json(listPropiedades({ includeOcultas: false }));
});

router.get('/', requirePermission('inventario.ver'), (req, res) => {
  const db = getDb();
  let sql = `${activoSelect} WHERE 1=1`;
  const params = [];

  if (req.query.estadoId) {
    sql += ' AND a.estado_id = ?';
    params.push(req.query.estadoId);
  }
  if (req.query.q) {
    const q = `%${req.query.q}%`;
    sql += ` AND (a.epc LIKE ? OR s.codigo LIKE ? OR a.descripcion LIKE ? OR a.ubicacion LIKE ? OR a.codigo_interno LIKE ?)`;
    params.push(q, q, q, q, q);
  }
  sql += ' ORDER BY a.fecha_registro DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapActivo));
});

router.get('/stats', requirePermission('inventario.ver'), (_req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) AS n FROM activos').get().n;
  const activas = db
    .prepare(
      `SELECT COUNT(*) AS n FROM activos a
       JOIN estados e ON e.id = a.estado_id WHERE e.es_activo = 1`
    )
    .get().n;
  res.json({ total, activas, inactivas: total - activas });
});

router.patch('/estado/lote', requirePermission('activos.cambiar_estado'), (req, res) => {
  const { ids, estadoId, motivoBaja } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un activo.' });
  }
  if (!estadoId) {
    return res.status(400).json({ error: 'El estado es obligatorio.' });
  }

  const db = getDb();
  const nuevoEstado = db.prepare('SELECT * FROM estados WHERE id = ?').get(estadoId);
  if (!nuevoEstado) return res.status(400).json({ error: 'Estado no válido.' });

  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
  const esBaja = esEstadoDeBaja(nuevoEstado);
  let actualizados = 0;
  const errores = [];

  const runBatch = db.transaction(() => {
    for (const id of uniqueIds) {
      const cur = getActivoById(id);
      if (!cur) {
        errores.push({ id, error: 'Activo no encontrado' });
        continue;
      }

      const updates = ['estado_id = ?', "updated_at = datetime('now','localtime')"];
      const params = [estadoId];

      if (esBaja) {
        updates.push("fecha_baja = datetime('now','localtime')");
        if (motivoBaja) {
          updates.push('motivo_baja = ?');
          params.push(motivoBaja);
        }
      } else if (estadoEstaHabilitado(nuevoEstado)) {
        updates.push('fecha_baja = NULL', "motivo_baja = ''");
      }

      params.push(id);
      db.prepare(`UPDATE activos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      registrarEvento({
        activoId: cur.id,
        epc: cur.epc,
        tipo: cur.estado_id === estadoId ? 'CAMBIO_ESTADO' : esBaja ? 'BAJA' : 'CAMBIO_ESTADO',
        estadoAnteriorId: cur.estado_id,
        estadoNuevoId: estadoId,
        usuarioId: req.user.id,
        origen: 'manual',
        metadata: { lote: true },
        notas: motivoBaja ?? '',
      });

      actualizados++;
    }
  });

  runBatch();

  res.json({
    total: actualizados,
    errores,
    mensaje: `${actualizados} activo(s) actualizado(s)${errores.length ? `, ${errores.length} con error` : ''}.`,
  });
});

router.patch('/ubicacion/lote', requirePermission('activos.editar'), (req, res) => {
  const { ids, ubicacionId } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un activo.' });
  }
  if (!ubicacionId) {
    return res.status(400).json({ error: 'La ubicación es obligatoria.' });
  }

  const db = getDb();
  const ub = db.prepare('SELECT nombre FROM ubicaciones WHERE id = ?').get(ubicacionId);
  if (!ub) return res.status(400).json({ error: 'Ubicación no válida.' });

  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
  let actualizados = 0;
  const errores = [];

  const runBatch = db.transaction(() => {
    for (const id of uniqueIds) {
      const cur = getActivoById(id);
      if (!cur) {
        errores.push({ id, error: 'Activo no encontrado' });
        continue;
      }

      const ubicacionAnterior = cur.ubicacion_nombre || cur.ubicacion;
      db.prepare(
        `UPDATE activos SET ubicacion_id = ?, ubicacion = ?, updated_at = datetime('now','localtime') WHERE id = ?`
      ).run(ubicacionId, ub.nombre, id);

      if (ub.nombre !== ubicacionAnterior) {
        registrarEvento({
          activoId: cur.id,
          epc: cur.epc,
          tipo: 'CAMBIO_UBICACION',
          ubicacionAnterior,
          ubicacionNueva: ub.nombre,
          usuarioId: req.user.id,
          origen: 'manual',
          metadata: { lote: true },
        });
      }

      actualizados++;
    }
  });

  runBatch();

  res.json({
    total: actualizados,
    errores,
    mensaje: `${actualizados} activo(s) reubicado(s)${errores.length ? `, ${errores.length} con error` : ''}.`,
  });
});

router.delete('/lote', requirePermission('activos.eliminar'), (req, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un activo.' });
  }

  const db = getDb();
  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
  let eliminados = 0;
  const errores = [];

  const runBatch = db.transaction(() => {
    for (const id of uniqueIds) {
      const cur = getActivoById(id);
      if (!cur) {
        errores.push({ id, error: 'Activo no encontrado' });
        continue;
      }

      registrarEvento({
        activoId: cur.id,
        epc: cur.epc,
        tipo: 'ELIMINACION',
        estadoAnteriorId: cur.estado_id,
        usuarioId: req.user.id,
        origen: 'manual',
        metadata: { lote: true },
      });

      db.prepare('DELETE FROM activos WHERE id = ?').run(id);
      eliminados++;
    }
  });

  runBatch();

  res.json({
    total: eliminados,
    errores,
    mensaje: `${eliminados} activo(s) eliminado(s)${errores.length ? `, ${errores.length} con error` : ''}.`,
  });
});

router.post('/lote', requirePermission('activos.crear'), (req, res) => {
  const { epcs, skuId, estadoId, ubicacionId, descripcion, codigoInterno, propiedadesExtra } =
    req.body ?? {};
  if (!Array.isArray(epcs) || epcs.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un TID.' });
  }
  try {
    validateCamposObligatoriosAlta({
      skuId,
      estadoId,
      ubicacionId,
      descripcion,
      codigoInterno,
      propiedadesExtra,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const db = getDb();
  let ubicacionText = '';
  if (ubicacionId) {
    const ub = db.prepare('SELECT nombre FROM ubicaciones WHERE id = ?').get(ubicacionId);
    if (ub) ubicacionText = ub.nombre;
  }

  const extraJson = sanitizePropiedadesExtraForCreate(propiedadesExtra);
  const unique = [...new Set(epcs.map((e) => String(e).trim().toUpperCase()).filter(Boolean))];
  const creados = [];
  const errores = [];

  const insert = db.prepare(`
    INSERT INTO activos (epc, sku_id, estado_id, ubicacion_id, ubicacion, descripcion, codigo_interno, propiedades_extra, fecha_registro, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `);

  const runLote = db.transaction(() => {
    for (const epc of unique) {
      try {
        const result = insert.run(
          epc,
          skuId,
          estadoId,
          ubicacionId ?? null,
          ubicacionText,
          descripcion ?? '',
          codigoInterno ?? '',
          extraJson
        );
        registrarEvento({
          activoId: result.lastInsertRowid,
          epc,
          tipo: 'ALTA',
          estadoNuevoId: estadoId,
          ubicacionNueva: ubicacionText,
          usuarioId: req.user.id,
          origen: 'manual',
          metadata: { lote: true },
        });
        creados.push(epc);
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          errores.push({ epc, tid: epc, error: 'TID ya registrado' });
        } else {
          throw e;
        }
      }
    }
  });

  runLote();

  if (creados.length === 0) {
    return res.status(409).json({
      error: 'Ningún activo pudo registrarse.',
      creados: [],
      errores,
    });
  }

  res.status(201).json({
    total: creados.length,
    creados,
    errores,
    mensaje: `${creados.length} activo(s) registrado(s)${errores.length ? `, ${errores.length} con error` : ''}.`,
  });
});

router.get('/:id/historial', requirePermission('activos.ver_historial'), (req, res) => {
  const activo = getActivoById(req.params.id);
  if (!activo) return res.status(404).json({ error: 'Activo no encontrado.' });
  res.json(getHistorialActivo(req.params.id));
});

router.post('/', requirePermission('activos.crear'), (req, res) => {
  const { epc, skuId, estadoId, ubicacionId, ubicacion, descripcion, codigoInterno, propiedadesExtra } =
    req.body ?? {};
  if (!epc?.trim()) {
    return res.status(400).json({ error: 'El TID es obligatorio.' });
  }
  try {
    validateCamposObligatoriosAlta({
      skuId,
      estadoId,
      ubicacionId,
      descripcion,
      codigoInterno,
      propiedadesExtra,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const db = getDb();
  let ubicacionText = ubicacion ?? '';
  if (ubicacionId) {
    const ub = db.prepare('SELECT nombre FROM ubicaciones WHERE id = ?').get(ubicacionId);
    if (ub) ubicacionText = ub.nombre;
  }

  const extraJson = sanitizePropiedadesExtraForCreate(propiedadesExtra);

  try {
    const result = db
      .prepare(
        `INSERT INTO activos (epc, sku_id, estado_id, ubicacion_id, ubicacion, descripcion, codigo_interno, propiedades_extra, fecha_registro, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`
      )
      .run(
        epc.trim().toUpperCase(),
        skuId,
        estadoId,
        ubicacionId ?? null,
        ubicacionText,
        descripcion ?? '',
        codigoInterno ?? '',
        extraJson
      );

    const activoId = result.lastInsertRowid;
    registrarEvento({
      activoId,
      epc: epc.trim(),
      tipo: 'ALTA',
      estadoNuevoId: estadoId,
      ubicacionNueva: ubicacionText,
      usuarioId: req.user.id,
      origen: 'manual',
    });

    const row = getActivoById(activoId);
    res.status(201).json(mapActivo(row));
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: `Ya existe un activo con TID "${epc}".` });
    }
    throw e;
  }
});

router.patch('/:id', requirePermission('activos.editar'), (req, res) => {
  const db = getDb();
  const cur = getActivoById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Activo no encontrado.' });

  const { descripcion, ubicacionId, ubicacion, codigoInterno, motivoBaja, propiedadesExtra } =
    req.body ?? {};
  const updates = [];
  const params = [];

  if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
  if (codigoInterno !== undefined) { updates.push('codigo_interno = ?'); params.push(codigoInterno); }
  if (motivoBaja !== undefined) { updates.push('motivo_baja = ?'); params.push(motivoBaja); }

  if (propiedadesExtra && typeof propiedadesExtra === 'object') {
    const customCols = listPropiedades({ includeOcultas: true }).filter((c) => c.esCustom);
    const allowed = new Set(customCols.map((c) => c.codigo));
    const patch = {};
    for (const [key, value] of Object.entries(propiedadesExtra)) {
      if (allowed.has(key)) patch[key] = value;
    }
    if (Object.keys(patch).length > 0) {
      updates.push('propiedades_extra = ?');
      params.push(mergePropiedadesExtra(cur.propiedades_extra, patch));
    }
  }

  let ubicacionAnterior = cur.ubicacion_nombre || cur.ubicacion;
  let ubicacionNueva = ubicacionAnterior;

  if (ubicacionId !== undefined) {
    updates.push('ubicacion_id = ?');
    params.push(ubicacionId);
    if (ubicacionId) {
      const ub = db.prepare('SELECT nombre FROM ubicaciones WHERE id = ?').get(ubicacionId);
      ubicacionNueva = ub?.nombre ?? '';
      updates.push('ubicacion = ?');
      params.push(ubicacionNueva);
    }
  } else if (ubicacion !== undefined) {
    updates.push('ubicacion = ?');
    params.push(ubicacion);
    ubicacionNueva = ubicacion;
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Sin cambios.' });
  }

  updates.push("updated_at = datetime('now','localtime')");
  params.push(req.params.id);
  db.prepare(`UPDATE activos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  if (ubicacionNueva !== ubicacionAnterior) {
    registrarEvento({
      activoId: cur.id,
      epc: cur.epc,
      tipo: 'CAMBIO_UBICACION',
      ubicacionAnterior,
      ubicacionNueva,
      usuarioId: req.user.id,
    });
  }

  res.json(mapActivo(getActivoById(req.params.id)));
});

router.patch('/:id/estado', requirePermission('activos.cambiar_estado'), (req, res) => {
  const { estadoId, motivoBaja } = req.body ?? {};
  const db = getDb();
  const cur = getActivoById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Activo no encontrado.' });

  const nuevoEstado = db.prepare('SELECT * FROM estados WHERE id = ?').get(estadoId);
  if (!nuevoEstado) return res.status(400).json({ error: 'Estado no válido.' });

  const esBaja = esEstadoDeBaja(nuevoEstado);
  const updates = ['estado_id = ?', "updated_at = datetime('now','localtime')"];
  const params = [estadoId];

  if (esBaja) {
    updates.push("fecha_baja = datetime('now','localtime')");
    if (motivoBaja) {
      updates.push('motivo_baja = ?');
      params.push(motivoBaja);
    }
  } else if (estadoEstaHabilitado(nuevoEstado)) {
    updates.push('fecha_baja = NULL', "motivo_baja = ''");
  }

  params.push(req.params.id);
  db.prepare(`UPDATE activos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  registrarEvento({
    activoId: cur.id,
    epc: cur.epc,
    tipo: cur.estado_id === estadoId ? 'CAMBIO_ESTADO' : esBaja ? 'BAJA' : 'CAMBIO_ESTADO',
    estadoAnteriorId: cur.estado_id,
    estadoNuevoId: estadoId,
    usuarioId: req.user.id,
    notas: motivoBaja ?? '',
  });

  res.json(mapActivo(getActivoById(req.params.id)));
});

router.delete('/:id', requirePermission('activos.eliminar'), (req, res) => {
  const db = getDb();
  const cur = getActivoById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Activo no encontrado.' });

  registrarEvento({
    activoId: cur.id,
    epc: cur.epc,
    tipo: 'ELIMINACION',
    estadoAnteriorId: cur.estado_id,
    usuarioId: req.user.id,
  });

  db.prepare('DELETE FROM activos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;

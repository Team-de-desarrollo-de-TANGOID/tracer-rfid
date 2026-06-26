import { getDb } from '../db.js';

export const SISTEMA_CODIGOS = new Set([
  'epc',
  'sku',
  'estado',
  'ubicacion',
  'fecha_registro',
  'fecha_baja',
]);

const CAMPO_ACTIVO_BY_CODIGO = {
  descripcion: 'descripcion',
  codigo_interno: 'codigo_interno',
  motivo_baja: 'motivo_baja',
};

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseExtra(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function mapColumna(row, enUso = false) {
  const campoActivo = row.campo_activo ?? CAMPO_ACTIVO_BY_CODIGO[row.codigo] ?? null;
  const esSistema = Boolean(row.es_sistema) || SISTEMA_CODIGOS.has(row.codigo);
  return {
    id: row.id,
    codigo: row.codigo,
    etiqueta: row.etiqueta,
    orden: row.orden,
    visibleDefault: Boolean(row.visible_default),
    editable: Boolean(row.editable),
    esSistema,
    oculta: Boolean(row.oculta),
    tipo: row.tipo || 'texto',
    campoActivo,
    esCustom: !esSistema && !campoActivo,
    enUso,
  };
}

export function getColumnasRows(includeOcultas = false) {
  const db = getDb();
  const sql = includeOcultas
    ? 'SELECT * FROM columnas_tabla ORDER BY orden, etiqueta'
    : 'SELECT * FROM columnas_tabla WHERE oculta = 0 ORDER BY orden, etiqueta';
  return db.prepare(sql).all();
}

export function propiedadEnUso(col) {
  const db = getDb();
  if (col.campo_activo || CAMPO_ACTIVO_BY_CODIGO[col.codigo]) {
    const campo = col.campo_activo || CAMPO_ACTIVO_BY_CODIGO[col.codigo];
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM activos WHERE ${campo} IS NOT NULL AND TRIM(${campo}) != ''`
      )
      .get();
    return row.n > 0;
  }
  const rows = db.prepare('SELECT propiedades_extra FROM activos').all();
  return rows.some((r) => {
    const extra = parseExtra(r.propiedades_extra);
    const val = extra[col.codigo];
    return val !== undefined && val !== null && String(val).trim() !== '';
  });
}

export function listPropiedades({ includeOcultas = false, withUsage = false } = {}) {
  const rows = getColumnasRows(includeOcultas);
  return rows.map((row) => mapColumna(row, withUsage ? propiedadEnUso(row) : false));
}

export function getPropiedadById(id) {
  const row = getDb().prepare('SELECT * FROM columnas_tabla WHERE id = ?').get(id);
  if (!row) return null;
  return mapColumna(row, propiedadEnUso(row));
}

function uniqueCodigo(base) {
  const db = getDb();
  let codigo = base;
  let n = 1;
  while (db.prepare('SELECT 1 FROM columnas_tabla WHERE codigo = ?').get(codigo)) {
    codigo = `${base}_${n++}`;
  }
  return codigo;
}

export function createPropiedad({ etiqueta, tipo = 'texto', editable = true, visibleDefault = false }) {
  const label = String(etiqueta ?? '').trim();
  if (!label) throw new Error('La etiqueta es obligatoria.');

  const db = getDb();
  const base = uniqueCodigo(`prop_${slugify(label) || 'campo'}`);
  const maxOrden = db.prepare('SELECT COALESCE(MAX(orden), 0) AS m FROM columnas_tabla').get().m;

  const result = db
    .prepare(
      `INSERT INTO columnas_tabla (codigo, etiqueta, orden, visible_default, editable, es_sistema, oculta, tipo, campo_activo)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, NULL)`
    )
    .run(base, label, maxOrden + 1, visibleDefault ? 1 : 0, editable ? 1 : 0, tipo);

  return getPropiedadById(result.lastInsertRowid);
}

export function updatePropiedad(id, body) {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM columnas_tabla WHERE id = ?').get(id);
  if (!cur) throw new Error('Propiedad no encontrada.');

  const esSistema = Boolean(cur.es_sistema) || SISTEMA_CODIGOS.has(cur.codigo);
  const updates = [];
  const params = [];

  if (!esSistema) {
    if (body.etiqueta !== undefined) {
      const label = String(body.etiqueta).trim();
      if (!label) throw new Error('La etiqueta no puede estar vacía.');
      updates.push('etiqueta = ?');
      params.push(label);
    }
    if (body.editable !== undefined) {
      updates.push('editable = ?');
      params.push(body.editable ? 1 : 0);
    }
    if (body.visibleDefault !== undefined) {
      updates.push('visible_default = ?');
      params.push(body.visibleDefault ? 1 : 0);
    }
    if (body.orden !== undefined) {
      updates.push('orden = ?');
      params.push(Number(body.orden));
    }
    if (body.tipo !== undefined && !cur.campo_activo && !CAMPO_ACTIVO_BY_CODIGO[cur.codigo]) {
      updates.push('tipo = ?');
      params.push(body.tipo);
    }
  }

  if (body.oculta !== undefined) {
    if (esSistema && body.oculta) {
      throw new Error('Las propiedades del sistema no pueden ocultarse.');
    }
    updates.push('oculta = ?');
    params.push(body.oculta ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error('Sin cambios permitidos.');
  }

  params.push(id);
  db.prepare(`UPDATE columnas_tabla SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return getPropiedadById(id);
}

export function deletePropiedad(id) {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM columnas_tabla WHERE id = ?').get(id);
  if (!cur) throw new Error('Propiedad no encontrada.');

  const esSistema = Boolean(cur.es_sistema) || SISTEMA_CODIGOS.has(cur.codigo);
  if (esSistema) throw new Error('Las propiedades del sistema no pueden eliminarse.');

  if (propiedadEnUso(cur)) {
    throw new Error(
      'La propiedad está en uso. Ocúltela en lugar de eliminarla.'
    );
  }

  db.prepare('DELETE FROM columnas_tabla WHERE id = ?').run(id);
  return { ok: true };
}

export function getValorPropiedad(row, col) {
  const codigo = typeof col === 'string' ? col : col.codigo;
  const campoActivo =
    typeof col === 'object'
      ? col.campoActivo || col.campo_activo || CAMPO_ACTIVO_BY_CODIGO[codigo]
      : CAMPO_ACTIVO_BY_CODIGO[codigo];

  if (campoActivo && row[campoActivo] !== undefined) {
    return row[campoActivo] ?? '';
  }

  const extra = parseExtra(row.propiedades_extra);
  return extra[codigo] ?? '';
}

export function mergePropiedadesExtra(currentRaw, patch) {
  const current = parseExtra(currentRaw);
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') {
      delete next[key];
    } else {
      next[key] = String(value);
    }
  }
  return JSON.stringify(next);
}

export { parseExtra };

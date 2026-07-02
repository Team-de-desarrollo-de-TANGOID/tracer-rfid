import { getDb } from '../db.js';

export const SISTEMA_CODIGOS = new Set([
  'tid',
  'sku',
  'estado',
  'ubicacion',
  'fecha_registro',
  'fecha_baja',
  'motivo_baja',
]);

const LEGACY_TID_CODIGO = 'epc';

const CAMPO_ACTIVO_BY_CODIGO = {
  descripcion: 'descripcion',
  codigo_interno: 'codigo_interno',
  motivo_baja: 'motivo_baja',
};

const ALTA_EXCLUDED_CODIGOS = new Set([
  'tid',
  LEGACY_TID_CODIGO,
  'fecha_registro',
  'fecha_baja',
  'motivo_baja',
]);

const TIPOS_PROPIEDAD_VALIDOS = new Set(['texto', 'numero', 'fecha', 'lista']);

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

function parseListaOpcionesJson(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeListaOpcionesInput(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((x) => String(x).trim()).filter(Boolean))];
  }
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((x) => String(x).trim()).filter(Boolean))];
      }
    } catch {
      return [
        ...new Set(
          input
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        ),
      ];
    }
  }
  return [];
}

function valorListaTieneContenido(raw, multiple) {
  if (!String(raw ?? '').trim()) return false;
  if (!multiple) return true;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.some((x) => String(x).trim());
  } catch {
    return false;
  }
}

function resolveTipoPropiedad(tipo) {
  const t = String(tipo ?? 'texto');
  if (!TIPOS_PROPIEDAD_VALIDOS.has(t)) {
    throw new Error('Tipo de propiedad no válido.');
  }
  return t;
}

export function mapColumna(row, vecesUtilizada = 0) {
  const campoActivo = row.campo_activo ?? CAMPO_ACTIVO_BY_CODIGO[row.codigo] ?? null;
  const esSistema =
    Boolean(row.es_sistema) ||
    SISTEMA_CODIGOS.has(row.codigo) ||
    row.codigo === LEGACY_TID_CODIGO;
  const creadoPor = esSistema ? 'Sistema' : row.creado_por_nombre || '—';
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
    enUso: vecesUtilizada > 0,
    vecesUtilizada,
    creadoPor,
    obligatoriaAlta: Boolean(row.obligatoria_alta),
    listaOpciones: parseListaOpcionesJson(row.lista_opciones),
    listaMultiple: Boolean(row.lista_multiple),
  };
}

const COLUMNAS_SELECT = `
  SELECT c.*, u.nombre AS creado_por_nombre
  FROM columnas_tabla c
  LEFT JOIN usuarios u ON u.id = c.creado_por_usuario_id
`;

export function getColumnasRows(includeOcultas = false) {
  const db = getDb();
  const sql = includeOcultas
    ? `${COLUMNAS_SELECT} ORDER BY c.orden, c.etiqueta`
    : `${COLUMNAS_SELECT} WHERE c.oculta = 0 ORDER BY c.orden, c.etiqueta`;
  return db.prepare(sql).all();
}

export function propiedadVecesUtilizada(col) {
  const db = getDb();
  const codigo = col.codigo;
  const campo = col.campo_activo || CAMPO_ACTIVO_BY_CODIGO[codigo];

  if (campo) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM activos WHERE ${campo} IS NOT NULL AND TRIM(${campo}) != ''`
      )
      .get();
    return row.n;
  }

  if (codigo === 'tid' || codigo === LEGACY_TID_CODIGO) {
    return db.prepare('SELECT COUNT(*) AS n FROM activos').get().n;
  }
  if (codigo === 'sku') {
    return db.prepare('SELECT COUNT(*) AS n FROM activos WHERE sku_id IS NOT NULL').get().n;
  }
  if (codigo === 'estado') {
    return db.prepare('SELECT COUNT(*) AS n FROM activos WHERE estado_id IS NOT NULL').get().n;
  }
  if (codigo === 'ubicacion') {
    return db
      .prepare(
        `SELECT COUNT(*) AS n FROM activos
         WHERE ubicacion_id IS NOT NULL
            OR (ubicacion IS NOT NULL AND TRIM(ubicacion) != '' AND ubicacion != '—')`
      )
      .get().n;
  }
  if (codigo === 'fecha_registro') {
    return db.prepare('SELECT COUNT(*) AS n FROM activos').get().n;
  }
  if (codigo === 'fecha_baja') {
    return db
      .prepare(
        `SELECT COUNT(*) AS n FROM activos WHERE fecha_baja IS NOT NULL AND TRIM(fecha_baja) != ''`
      )
      .get().n;
  }

  const rows = db.prepare('SELECT propiedades_extra FROM activos').all();
  let count = 0;
  for (const r of rows) {
    const extra = parseExtra(r.propiedades_extra);
    const val = extra[codigo];
    if (val !== undefined && val !== null && String(val).trim() !== '') count += 1;
  }
  return count;
}

export function propiedadEnUso(col) {
  return propiedadVecesUtilizada(col) > 0;
}

export function listPropiedades({ includeOcultas = false, withUsage = false } = {}) {
  const rows = getColumnasRows(includeOcultas);
  return rows.map((row) => {
    const veces = withUsage ? propiedadVecesUtilizada(row) : 0;
    return mapColumna(row, veces);
  });
}

export function getPropiedadById(id) {
  const row = getDb()
    .prepare(`${COLUMNAS_SELECT} WHERE c.id = ?`)
    .get(id);
  if (!row) return null;
  return mapColumna(row, propiedadVecesUtilizada(row));
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

export function createPropiedad({
  etiqueta,
  tipo = 'texto',
  editable = true,
  visibleDefault = false,
  obligatoriaAlta = false,
  listaOpciones = [],
  listaMultiple = false,
  creadoPorUsuarioId = null,
}) {
  const label = String(etiqueta ?? '').trim();
  if (!label) throw new Error('La etiqueta es obligatoria.');

  const tipoResolved = resolveTipoPropiedad(tipo);
  const opciones = normalizeListaOpcionesInput(listaOpciones);
  const multiple = Boolean(listaMultiple);

  if (tipoResolved === 'lista' && opciones.length < 2) {
    throw new Error('La lista debe tener al menos 2 opciones.');
  }

  const db = getDb();
  const base = uniqueCodigo(`prop_${slugify(label) || 'campo'}`);
  const maxOrden = db.prepare('SELECT COALESCE(MAX(orden), 0) AS m FROM columnas_tabla').get().m;

  const result = db
    .prepare(
      `INSERT INTO columnas_tabla (
        codigo, etiqueta, orden, visible_default, editable, es_sistema, oculta,
        tipo, campo_activo, obligatoria_alta, lista_opciones, lista_multiple, creado_por_usuario_id
      ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, ?, ?, ?)`
    )
    .run(
      base,
      label,
      maxOrden + 1,
      visibleDefault ? 1 : 0,
      editable ? 1 : 0,
      tipoResolved,
      obligatoriaAlta ? 1 : 0,
      JSON.stringify(tipoResolved === 'lista' ? opciones : []),
      tipoResolved === 'lista' && multiple ? 1 : 0,
      creadoPorUsuarioId || null
    );

  return getPropiedadById(result.lastInsertRowid);
}

export function updatePropiedad(id, body) {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM columnas_tabla WHERE id = ?').get(id);
  if (!cur) throw new Error('Propiedad no encontrada.');

  const esSistema =
    Boolean(cur.es_sistema) ||
    SISTEMA_CODIGOS.has(cur.codigo) ||
    cur.codigo === LEGACY_TID_CODIGO;
  const esCustomPura = !esSistema && !cur.campo_activo && !CAMPO_ACTIVO_BY_CODIGO[cur.codigo];
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
    if (body.tipo !== undefined && esCustomPura) {
      const tipoResolved = resolveTipoPropiedad(body.tipo);
      updates.push('tipo = ?');
      params.push(tipoResolved);
      if (tipoResolved !== 'lista') {
        updates.push("lista_opciones = '[]'", 'lista_multiple = 0');
      }
    }
  }

  if (esCustomPura && (body.listaOpciones !== undefined || body.listaMultiple !== undefined)) {
    const tipoResuelto = body.tipo !== undefined ? resolveTipoPropiedad(body.tipo) : cur.tipo;
    if (tipoResuelto === 'lista') {
      if (body.listaOpciones !== undefined) {
        const opciones = normalizeListaOpcionesInput(body.listaOpciones);
        if (opciones.length < 2) {
          throw new Error('La lista debe tener al menos 2 opciones.');
        }
        updates.push('lista_opciones = ?');
        params.push(JSON.stringify(opciones));
      }
      if (body.listaMultiple !== undefined) {
        updates.push('lista_multiple = ?');
        params.push(body.listaMultiple ? 1 : 0);
      }
    }
  }

  if (body.oculta !== undefined) {
    if (esSistema && body.oculta) {
      throw new Error('Las propiedades del sistema no pueden ocultarse.');
    }
    updates.push('oculta = ?');
    params.push(body.oculta ? 1 : 0);
  }

  if (body.obligatoriaAlta !== undefined) {
    if (ALTA_EXCLUDED_CODIGOS.has(cur.codigo)) {
      throw new Error('Esta propiedad no participa en el alta de activos.');
    }
    updates.push('obligatoria_alta = ?');
    params.push(body.obligatoriaAlta ? 1 : 0);
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

  const esSistema =
    Boolean(cur.es_sistema) ||
    SISTEMA_CODIGOS.has(cur.codigo) ||
    cur.codigo === LEGACY_TID_CODIGO;
  if (esSistema) throw new Error('Las propiedades del sistema no pueden eliminarse.');

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

export function validateCamposObligatoriosAlta(payload) {
  const { skuId, estadoId, ubicacionId, descripcion, codigoInterno, propiedadesExtra } =
    payload ?? {};

  const obligatorias = listPropiedades({ includeOcultas: false }).filter(
    (c) => !c.oculta && !ALTA_EXCLUDED_CODIGOS.has(c.codigo) && c.obligatoriaAlta
  );

  const missing = [];
  for (const col of obligatorias) {
    let ok = false;
    switch (col.codigo) {
      case 'sku':
        ok = Boolean(skuId);
        break;
      case 'estado':
        ok = Boolean(estadoId);
        break;
      case 'ubicacion':
        ok = Boolean(ubicacionId);
        break;
      case 'descripcion':
        ok = Boolean(String(descripcion ?? '').trim());
        break;
      case 'codigo_interno':
        ok = Boolean(String(codigoInterno ?? '').trim());
        break;
      default:
        if (col.esCustom) {
          const raw = propiedadesExtra?.[col.codigo];
          if (col.tipo === 'lista') {
            ok = valorListaTieneContenido(raw, col.listaMultiple);
          } else {
            ok = Boolean(String(raw ?? '').trim());
          }
        }
        break;
    }
    if (!ok) missing.push(col.etiqueta);
  }

  if (missing.length > 0) {
    throw new Error(`Completá los campos obligatorios: ${missing.join(', ')}.`);
  }
}

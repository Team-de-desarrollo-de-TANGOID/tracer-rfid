import { getDb } from '../db.js';
import { listPropiedades } from './propiedadesService.js';
import { normalizeColumnaCodigo } from '../constants/columnaCodigos.js';
import {
  MAX_VISIBLE_TABLE_COLUMNS,
  clampVisibleColumns,
} from '../constants/inventoryColumns.js';

export function getColumnasCatalogo() {
  return listPropiedades({ includeOcultas: false, withUsage: false });
}

export function getPreferenciasInventario(usuarioId) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT valor FROM usuario_preferencias WHERE usuario_id = ? AND clave = 'inventario_columnas'`
    )
    .get(usuarioId);

  const catalogo = getColumnasCatalogo();

  if (!row) {
    return clampVisibleColumns(
      catalogo.filter((c) => c.esSistema).map((c) => c.codigo)
    );
  }

  try {
    const saved = JSON.parse(row.valor);
    if (Array.isArray(saved) && saved.length > 0) {
      const visibleSet = new Set(catalogo.map((c) => c.codigo));
      const normalized = saved.map((c) => normalizeColumnaCodigo(String(c)));
      return clampVisibleColumns(normalized.filter((c) => visibleSet.has(c)));
    }
  } catch {
    /* fallback */
  }

  return clampVisibleColumns(catalogo.filter((c) => c.esSistema).map((c) => c.codigo));
}

export function savePreferenciasInventario(usuarioId, columnas) {
  const db = getDb();
  const catalogo = new Set(getColumnasCatalogo().map((c) => c.codigo));
  const valid = clampVisibleColumns(columnas.filter((c) => catalogo.has(c)));
  if (valid.length === 0) {
    throw new Error('Debe haber al menos una columna visible.');
  }
  if (columnas.filter((c) => catalogo.has(c)).length > MAX_VISIBLE_TABLE_COLUMNS) {
    throw new Error(`Máximo ${MAX_VISIBLE_TABLE_COLUMNS} columnas visibles.`);
  }

  db.prepare(
    `INSERT INTO usuario_preferencias (usuario_id, clave, valor)
     VALUES (?, 'inventario_columnas', ?)
     ON CONFLICT(usuario_id, clave) DO UPDATE SET valor = excluded.valor`
  ).run(usuarioId, JSON.stringify(valid));

  return valid;
}

export function getInventarioConfig(usuarioId) {
  const catalogo = getColumnasCatalogo();
  const visibles = getPreferenciasInventario(usuarioId);
  return {
    columnas: catalogo,
    visibles,
    columnasActivas: catalogo
      .filter((c) => visibles.includes(c.codigo))
      .sort((a, b) => visibles.indexOf(a.codigo) - visibles.indexOf(b.codigo)),
  };
}

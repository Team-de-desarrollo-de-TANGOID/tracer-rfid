import type { ColumnaTabla } from '../types';

export function parseListaOpciones(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function parseListaValor(raw: string, multiple: boolean): string[] {
  if (!raw?.trim()) return [];
  if (!multiple) return [raw.trim()];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function formatListaValor(values: string[], multiple: boolean): string {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (!multiple) return clean[0] ?? '';
  return JSON.stringify(clean);
}

export function listaValorTieneContenido(raw: string | undefined, multiple: boolean): boolean {
  return parseListaValor(raw ?? '', multiple).length > 0;
}

export function formatListaValorDisplay(raw: string, col: ColumnaTabla): string {
  const multiple = Boolean(col.listaMultiple);
  const vals = parseListaValor(raw, multiple);
  if (vals.length === 0) return '';
  return multiple ? vals.join(', ') : vals[0];
}

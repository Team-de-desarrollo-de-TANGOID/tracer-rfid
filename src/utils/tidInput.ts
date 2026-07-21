/** Normaliza un TID para comparación y almacenamiento (quita padding 00 del lector). */
export function normalizeTid(raw: string): string {
  let t = raw.trim().toUpperCase();
  while (t.length >= 10 && t.endsWith('00')) {
    t = t.slice(0, -2);
  }
  return t;
}

/** Extrae TIDs únicos desde texto pegado (saltos de línea, comas, espacios). */
export function parseTidsFromText(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[\n,;\t]+/)) {
    for (const token of part.split(/\s+/)) {
      const tid = normalizeTid(token);
      if (!tid || seen.has(tid)) continue;
      seen.add(tid);
      result.push(tid);
    }
  }
  return result;
}

/** Agrega TIDs nuevos sin duplicar. Devuelve cuántos se agregaron. */
export function mergeTids(existing: string[], incoming: string[]): { merged: string[]; added: number } {
  const set = new Set(existing);
  let added = 0;
  for (const tid of incoming) {
    const n = normalizeTid(tid);
    if (!n || set.has(n)) continue;
    set.add(n);
    added++;
  }
  return { merged: [...set], added };
}

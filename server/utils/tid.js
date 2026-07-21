/**
 * Normaliza TID hex: uppercase y quita bytes 00 de padding que el FX9600
 * suele agregar al leer con Tid_Word_Count mayor al TID útil de la etiqueta.
 * Conserva al menos 8 caracteres hex (4 bytes).
 */
export function normalizeTid(raw) {
  let t = String(raw ?? '')
    .trim()
    .toUpperCase();
  while (t.length >= 10 && t.endsWith('00')) {
    t = t.slice(0, -2);
  }
  return t;
}

/** True si dos TIDs son el mismo ignorando padding de ceros al final. */
export function tidsEquivalent(a, b) {
  const na = normalizeTid(a);
  const nb = normalizeTid(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [longer, shorter] = na.length >= nb.length ? [na, nb] : [nb, na];
  const suffix = longer.slice(shorter.length);
  return longer.startsWith(shorter) && suffix.length > 0 && /^0+$/.test(suffix);
}

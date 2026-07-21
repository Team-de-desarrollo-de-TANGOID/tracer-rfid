import { getDb } from '../db.js';

/** Autenticación del lector FX9600 hacia la web app (mismo token que User App API). */
export function portalReaderAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token =
    (header.startsWith('Bearer ') ? header.slice(7) : header) ||
    req.headers['x-racketclub-token'] ||
    '';

  const row = getDb().prepare("SELECT value FROM config WHERE key = 'fx9600_app_token'").get();
  const expected = row?.value || '';

  if (!expected || token !== expected) {
    return res.status(401).json({ ok: false, error: 'Token API invalido o ausente' });
  }
  next();
}

/** Credenciales de monitor en memoria (no persistidas). */
const sessions = new Map();
const TTL_MS = 45 * 60 * 1000;

export function setMonitorSession(userId, creds) {
  sessions.set(userId, { ...creds, at: Date.now() });
}

export function getMonitorSession(userId) {
  const row = sessions.get(userId);
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    sessions.delete(userId);
    return null;
  }
  return row;
}

export function clearMonitorSession(userId) {
  sessions.delete(userId);
}

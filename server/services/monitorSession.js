/** Credenciales de monitor en memoria, ligadas a la sesión del usuario en RFID TRACER. */
const sessions = new Map();

export function setMonitorSession(userId, creds) {
  sessions.set(userId, { ...creds, at: Date.now() });
}

export function getMonitorSession(userId) {
  return sessions.get(userId) ?? null;
}

export function touchMonitorSession(userId) {
  const row = sessions.get(userId);
  if (!row) return null;
  row.at = Date.now();
  sessions.set(userId, row);
  return row;
}

export function clearMonitorSession(userId) {
  sessions.delete(userId);
}

export function clearAllMonitorSessions() {
  sessions.clear();
}

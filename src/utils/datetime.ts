/** Zona horaria operativa del club (Buenos Aires, Argentina). */
export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires';

const BA_OFFSET = '-03:00';

/** YYYY-MM-DD HH:mm:ss en hora de Buenos Aires (misma forma que guarda el servidor). */
export function nowInAppTzSql(offsetMs = 0): string {
  const d = new Date(Date.now() + offsetMs);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Formatea timestamps guardados como YYYY-MM-DD HH:mm:ss en hora de Buenos Aires.
 */
export function formatFechaHora(value: string): string {
  if (!value) return '';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const sec = m[6] ?? '00';
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${sec}${BA_OFFSET}`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('es-AR', {
        timeZone: APP_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

/** Zona horaria operativa del club (Buenos Aires, Argentina). */
export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires';

const BA_OFFSET = '-03:00';

function partsFromDate(date, options) {
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, ...options }).formatToParts(date);
}

function part(date, type, options) {
  return partsFromDate(date, options).find((p) => p.type === type)?.value ?? '';
}

/** YYYY-MM-DD HH:mm:ss en hora de Buenos Aires. */
export function formatInstantInAppTz(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const year = part(d, 'year', { year: 'numeric' });
  const month = part(d, 'month', { month: '2-digit' });
  const day = part(d, 'day', { day: '2-digit' });
  const hour = part(d, 'hour', { hour: '2-digit', hour12: false });
  const minute = part(d, 'minute', { minute: '2-digit' });
  const second = part(d, 'second', { second: '2-digit' });
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function nowInAppTz() {
  return formatInstantInAppTz(new Date());
}

export function formatUnixTsAppTz(ts) {
  if (ts == null || ts === '') return null;
  const n = Number(ts);
  const d = Number.isFinite(n) ? new Date(n * 1000) : new Date(ts);
  return formatInstantInAppTz(d);
}

function ymdInAppTz(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return {
    year: part(d, 'year', { year: 'numeric' }),
    month: part(d, 'month', { month: '2-digit' }),
    day: part(d, 'day', { day: '2-digit' }),
  };
}

function noonBaDate(date = new Date()) {
  const { year, month, day } = ymdInAppTz(date);
  return new Date(`${year}-${month}-${day}T12:00:00${BA_OFFSET}`);
}

function weekdayInAppTz(date = new Date()) {
  const wd = part(date, 'weekday', { weekday: 'short' });
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

export function addDaysInAppTz(date, deltaDays) {
  const d = noonBaDate(date);
  d.setDate(d.getDate() + deltaDays);
  return d;
}

export function startOfDayAppTzSql(date = new Date()) {
  const { year, month, day } = ymdInAppTz(date);
  return `${year}-${month}-${day} 00:00:00`;
}

export function endOfDayAppTzSql(date = new Date()) {
  const { year, month, day } = ymdInAppTz(date);
  return `${year}-${month}-${day} 23:59:59`;
}

export function startOfWeekMondayAppTzSql(date = new Date()) {
  const wd = weekdayInAppTz(date);
  const diff = wd === 0 ? -6 : 1 - wd;
  return startOfDayAppTzSql(addDaysInAppTz(date, diff));
}

export function firstDayOfMonthAppTzSql(date = new Date()) {
  const { year, month } = ymdInAppTz(date);
  return `${year}-${month}-01 00:00:00`;
}

export function lastDayOfPreviousMonthAppTzSql(date = new Date()) {
  const d = noonBaDate(date);
  d.setDate(0);
  return endOfDayAppTzSql(d);
}

export function firstDayOfPreviousMonthAppTzSql(date = new Date()) {
  const d = noonBaDate(date);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return startOfDayAppTzSql(d);
}

import { getDb } from '../db.js';
import { fetchTagEvents } from './fx9600Service.js';
import {
  insertDeteccionPuerta,
  countDetecciones,
  buildDeteccionAlerta,
} from './portalEventosService.js';
import { getPortalDedupeSec, getPortalAlertsEnabled } from './readerSettingsService.js';
import { formatUnixTsAppTz, startOfDayAppTzSql, endOfDayAppTzSql } from '../utils/appTimezone.js';

const alertSubscribers = new Set();
/** Eventos del lector ya enviados a la UI (evita doble push webhook+poller). */
const notifiedEventIds = new Set();
const NOTIFIED_EVENT_CAP = 2000;
let lastPollerErrorLog = 0;

function getPortalLastEventId() {
  const row = getDb().prepare("SELECT value FROM config WHERE key = 'portal_last_event_id'").get();
  return Number(row?.value || 0);
}

function setPortalLastEventId(id) {
  getDb()
    .prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('portal_last_event_id', ?)")
    .run(String(id));
}

export function subscribePortalAlerts(res) {
  alertSubscribers.add(res);
  return () => alertSubscribers.delete(res);
}

function broadcastPortalAlert(payload) {
  const data = JSON.stringify(payload);
  for (const res of alertSubscribers) {
    try {
      res.write(`event: alert\ndata: ${data}\n\n`);
    } catch {
      alertSubscribers.delete(res);
    }
  }
}

function formatReaderTs(ts) {
  return formatUnixTsAppTz(ts);
}

function isDeniedEvent(ev) {
  return ev?.type === 'denied' || ev?.authorized === false;
}

function eventKey(evOrItem) {
  const id = evOrItem?.eventoLectorId ?? evOrItem?.id ?? evOrItem?.eventId;
  if (id != null && id !== '') return `ev-${id}`;
  const tid = String(evOrItem?.tid || evOrItem?.tag || '').toUpperCase();
  const at = evOrItem?.detectadoAt ?? evOrItem?.ts ?? '';
  if (!tid) return null;
  return `tid-${tid}-${at}`;
}

function markEventNotified(key) {
  if (!key) return;
  notifiedEventIds.add(key);
  if (notifiedEventIds.size > NOTIFIED_EVENT_CAP) {
    const drop = notifiedEventIds.size - NOTIFIED_EVENT_CAP;
    let i = 0;
    for (const k of notifiedEventIds) {
      notifiedEventIds.delete(k);
      if (++i >= drop) break;
    }
  }
}

/** Una notificación UI por evento real del lector (no por cooldown de tiempo). */
function shouldNotifyUi(item) {
  const key = eventKey(item);
  if (!key) return false;
  if (notifiedEventIds.has(key)) return false;
  return true;
}

function detectionFromEvent(ev) {
  const tid = (ev.tid || ev.tag || '').toUpperCase();
  if (!tid) return null;
  const detectadoAt = formatReaderTs(ev.ts) || undefined;
  const base = {
    tid,
    antena: ev.ant ?? ev.antena ?? null,
    rssi: ev.rssi ?? null,
    eventoLectorId: ev.id ?? ev.eventId ?? null,
    detectadoAt,
    tipo: 'SALIDA_DENEGADA',
  };
  const persisted = insertDeteccionPuerta(base);
  return persisted || buildDeteccionAlerta(base);
}

function detectionFromHint(hint) {
  if (!hint || typeof hint !== 'object') return null;
  const tid = String(hint.tid || hint.tag || '').toUpperCase();
  if (!tid) return null;
  const tipo = String(hint.type || hint.tipo || '').toLowerCase();
  if (tipo && tipo !== 'denied') return null;

  const detectadoAt = formatReaderTs(hint.ts) || undefined;
  const base = {
    tid,
    antena: hint.ant ?? hint.antena ?? null,
    rssi: hint.rssi ?? null,
    eventoLectorId: hint.eventId ?? hint.id ?? null,
    detectadoAt,
    tipo: 'SALIDA_DENEGADA',
  };
  const persisted = insertDeteccionPuerta(base);
  return persisted || buildDeteccionAlerta(base);
}

function dedupeAlertItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = eventKey(item) || `tid-${item.tid}-${item.detectadoAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function nextCursorId(since, events, hint) {
  let next = since;
  for (const ev of events) {
    if (!isDeniedEvent(ev)) continue;
    const id = Number(ev.id ?? ev.eventId ?? 0);
    if (id > next) next = id;
  }
  const hintId = Number(hint?.eventId ?? hint?.id ?? 0);
  if (hintId > next) next = hintId;
  return next;
}

/**
 * Tras alerta push del FX9600: consulta /api/tag-events en el lector,
 * persiste denegadas nuevas y notifica clientes web (SSE).
 */
export async function processPortalAlertFromReader(hint = {}) {
  let since = getPortalLastEventId();
  let events = [];
  let latest = since;
  let fetchError = null;

  try {
    let fetched = await fetchTagEvents(since);
    if (!fetched.restOk) {
      throw new Error(fetched.error || 'No se pudo obtener el reporte de tags del lector');
    }
    events = fetched.events ?? [];
    latest = fetched.latest ?? since;

    // Buffer del lector reiniciado (ids vuelven a 1).
    if (latest < since) {
      since = 0;
      setPortalLastEventId(0);
      fetched = await fetchTagEvents(0);
      events = fetched.events ?? [];
      latest = fetched.latest ?? 0;
    }
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
    if (!hint?.tid) {
      throw new Error(fetchError);
    }
  }

  const alertItems = [];
  let persisted = 0;
  for (const ev of events) {
    if (!isDeniedEvent(ev)) continue;
    const item = detectionFromEvent(ev);
    if (!item) continue;
    if (item.id > 0) persisted++;
    if (shouldNotifyUi(item)) alertItems.push(item);
  }

  if (hint?.tid) {
    const fromHint = detectionFromHint(hint);
    if (fromHint) {
      if (fromHint.id > 0) persisted++;
      if (shouldNotifyUi(fromHint)) alertItems.push(fromHint);
    }
  }

  const nextId = nextCursorId(since, events, hint);
  if (nextId > since) setPortalLastEventId(nextId);

  const notifications = dedupeAlertItems(alertItems);

  if (notifications.length > 0) {
    for (const item of notifications) {
      markEventNotified(eventKey(item));
    }

    const uiEnabled = getPortalAlertsEnabled();
    if (!uiEnabled) {
      return {
        ingested: persisted,
        notified: 0,
        detecciones: notifications,
        latest,
        since,
        fetchWarning: fetchError ?? undefined,
        sseClients: alertSubscribers.size,
        alertsSuppressed: true,
      };
    }

    const from = startOfDayAppTzSql();
    const to = endOfDayAppTzSql();
    const totalEnPeriodo = countDetecciones({ from, to });

    const payload = {
      kind: notifications.length > 1 ? 'denied_batch' : 'denied',
      count: notifications.length,
      totalEnPeriodo,
      detecciones: notifications,
      deteccion: notifications[0],
    };

    if (alertSubscribers.size === 0) {
      console.warn(
        '[Portal] alerta sin clientes SSE conectados (%d detecciones)',
        notifications.length
      );
    }
    broadcastPortalAlert(payload);
  }

  return {
    ingested: persisted,
    notified: notifications.length,
    detecciones: notifications,
    latest,
    since,
    fetchWarning: fetchError ?? undefined,
    sseClients: alertSubscribers.size,
  };
}

let pollerTimer = null;

/** Consulta tag-events del lector periódicamente (no depende del webhook ni de la UI). */
export function startPortalTagEventsPoller() {
  if (pollerTimer) return;
  const tick = async () => {
    try {
      await processPortalAlertFromReader({});
    } catch (e) {
      const now = Date.now();
      if (now - lastPollerErrorLog > 30_000) {
        lastPollerErrorLog = now;
        console.warn('[Portal] poller:', e instanceof Error ? e.message : e);
      }
    }
  };
  const schedule = () => {
    const ms = Math.max(1500, Math.floor(getPortalDedupeSec() * 500));
    pollerTimer = setTimeout(async () => {
      await tick();
      schedule();
    }, ms);
  };
  void tick();
  schedule();
}

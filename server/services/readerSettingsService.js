import { getDb } from '../db.js';
import { callUserAppApi, getFx9600Config, saveFx9600Config } from './fx9600Service.js';

export const READER_SETTINGS_KEY = 'fx9600_reader_settings';
export const PORTAL_DEDUPE_KEY = 'portal_dedupe_sec';

export const DEFAULT_READER_SETTINGS = {
  seenTimeoutSec: 5,
  repeatReadLogSec: 3,
  tagPopulation: 64,
  antenna1Enabled: true,
  antenna1Power: 27,
  antenna2Enabled: true,
  antenna2Power: 27,
  antenna3Enabled: false,
  antenna3Power: 27,
  antenna4Enabled: false,
  antenna4Power: 27,
  alertViaGpo: true,
  alertGpoPin: 1,
  alertGpoDurationSec: 5,
  portalAlertsEnabled: true,
  rfSession: 'S0',
  failedTidRetries: 3,
  tidWordCount: 6,
  readEnvironment: 'LOW_INTERFERENCE',
};

function normalizeSettings(raw = {}) {
  const d = DEFAULT_READER_SETTINGS;
  const seenTimeoutSec = Math.max(
    1,
    Math.min(
      60,
      Number(raw.seenTimeoutSec ?? raw.portalDedupeSec ?? d.seenTimeoutSec)
    )
  );
  return {
    seenTimeoutSec,
    repeatReadLogSec: Math.max(0, Math.min(60, Number(raw.repeatReadLogSec ?? d.repeatReadLogSec))),
    tagPopulation: Math.max(1, Math.min(512, Number(raw.tagPopulation ?? d.tagPopulation))),
    antenna1Enabled: Boolean(raw.antenna1Enabled ?? d.antenna1Enabled),
    antenna1Power: Math.max(10, Math.min(30, Number(raw.antenna1Power ?? d.antenna1Power))),
    antenna2Enabled: Boolean(raw.antenna2Enabled ?? d.antenna2Enabled),
    antenna2Power: Math.max(10, Math.min(30, Number(raw.antenna2Power ?? d.antenna2Power))),
    antenna3Enabled: Boolean(raw.antenna3Enabled ?? d.antenna3Enabled),
    antenna3Power: Math.max(10, Math.min(30, Number(raw.antenna3Power ?? d.antenna3Power))),
    antenna4Enabled: Boolean(raw.antenna4Enabled ?? d.antenna4Enabled),
    antenna4Power: Math.max(10, Math.min(30, Number(raw.antenna4Power ?? d.antenna4Power))),
    alertViaGpo: Boolean(raw.alertViaGpo ?? d.alertViaGpo),
    alertGpoPin: Math.max(1, Math.min(4, Number(raw.alertGpoPin ?? d.alertGpoPin))),
    alertGpoDurationSec: Math.max(0.5, Math.min(60, Number(raw.alertGpoDurationSec ?? d.alertGpoDurationSec))),
    portalAlertsEnabled: Boolean(raw.portalAlertsEnabled ?? d.portalAlertsEnabled),
    rfSession: String(raw.rfSession ?? d.rfSession).toUpperCase() === 'S1' ? 'S1' : 'S0',
    failedTidRetries: Math.max(1, Math.min(20, Number(raw.failedTidRetries ?? d.failedTidRetries))),
    tidWordCount: Math.max(1, Math.min(6, Number(raw.tidWordCount ?? d.tidWordCount))),
    readEnvironment: String(raw.readEnvironment ?? d.readEnvironment),
  };
}

function loadStoredSettings() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(READER_SETTINGS_KEY);
  if (!row?.value) return { ...DEFAULT_READER_SETTINGS };
  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_READER_SETTINGS };
  }
}

function saveStoredSettings(settings) {
  const normalized = normalizeSettings(settings);
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(
    READER_SETTINGS_KEY,
    JSON.stringify(normalized)
  );
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(
    PORTAL_DEDUPE_KEY,
    String(normalized.seenTimeoutSec)
  );
  saveFx9600Config({ gpoPin: normalized.alertGpoPin });
  return normalized;
}

/** Segundos de deduplicación de alertas en la app web. */
export function getPortalDedupeSec() {
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(PORTAL_DEDUPE_KEY);
  const n = Number(row?.value);
  if (Number.isFinite(n) && n > 0) return n;
  return loadStoredSettings().seenTimeoutSec;
}

/** Modal y avisos SSE en la app web (solo PC, no va al lector). */
export function getPortalAlertsEnabled() {
  return loadStoredSettings().portalAlertsEnabled;
}

function readerPayload(settings) {
  const s = normalizeSettings(settings);
  const { portalAlertsEnabled: _web, ...readerOnly } = s;
  return readerOnly;
}

export async function fetchReaderSettingsFromDevice() {
  try {
    const data = await callUserAppApi('GET', '/api/settings', null, { timeoutMs: 12000 });
    const remote = data?.settings ?? {};
    const merged = normalizeSettings({ ...loadStoredSettings(), ...remote });
    return { ok: true, settings: merged, source: 'reader' };
  } catch (e) {
    return {
      ok: false,
      settings: loadStoredSettings(),
      source: 'local',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getReaderSettings() {
  const local = loadStoredSettings();
  const remote = await fetchReaderSettingsFromDevice();
  if (remote.ok) {
    const merged = normalizeSettings({
      ...local,
      ...remote.settings,
      portalAlertsEnabled: local.portalAlertsEnabled,
    });
    return { settings: merged, readerConnected: true, readerSettings: remote.settings };
  }
  return {
    settings: local,
    readerConnected: false,
    readerError: remote.error,
  };
}

export function getPortalUiSettings() {
  const s = loadStoredSettings();
  return {
    portalAlertsEnabled: s.portalAlertsEnabled,
    portalDedupeSec: s.seenTimeoutSec,
  };
}

/** Aplica en el lector la config guardada en PC (sin intervención del usuario). */
export async function ensureReaderSettingsApplied() {
  const settings = loadStoredSettings();
  const payload = readerPayload(settings);
  try {
    const remote = await callUserAppApi('GET', '/api/settings', null, { timeoutMs: 12000 });
    const remoteOnly = readerPayload({
      ...settings,
      ...(remote?.settings || {}),
      portalAlertsEnabled: settings.portalAlertsEnabled,
    });
    if (JSON.stringify(remoteOnly) === JSON.stringify(payload)) {
      return { ok: true, applied: false, skipped: true };
    }
    await callUserAppApi('PUT', '/api/settings', payload, { timeoutMs: 25000 });
    return { ok: true, applied: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn('[ReaderSettings] No se pudo aplicar config al lector:', error);
    return { ok: false, applied: false, error };
  }
}

export async function applyReaderSettings(partial) {
  const merged = normalizeSettings({ ...loadStoredSettings(), ...partial });
  saveStoredSettings(merged);

  let readerApplied = false;
  let readerError;
  try {
    await callUserAppApi('PUT', '/api/settings', readerPayload(merged), { timeoutMs: 25000 });
    readerApplied = true;
  } catch (e) {
    readerError = e instanceof Error ? e.message : String(e);
  }

  return {
    ok: true,
    settings: merged,
    readerApplied,
    readerError,
    gpoPin: merged.alertGpoPin,
  };
}

export function getReaderSettingsForSync() {
  return readerPayload(loadStoredSettings());
}

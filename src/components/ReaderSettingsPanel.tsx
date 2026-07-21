import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, Save } from 'lucide-react';
import { api } from '../api/client';
import { useRegisterUnsavedGuard } from '../hooks/useRegisterUnsavedGuard';

const GPO_PINS = [1, 2, 3, 4] as const;
const GPO_OFF_STATE: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };

/** Valores por defecto (alineados con server/services/readerSettingsService.js). */
const FIELD_DEFAULTS = {
  seenTimeoutSec: '5 s',
  tagPopulation: '64',
  portalAlertsEnabled: 'Habilitadas',
  alertViaGpo: 'Habilitada',
  alertGpoPin: 'GPO 1',
  alertGpoDurationSec: '5 s',
  antennaEnabled: (n: number) => (n <= 2 ? 'Habilitada' : 'Deshabilitada'),
  antennaPower: '27 dBm',
  rfSession: 'S0',
  failedTidRetries: '3',
  tidWordCount: '6',
  readEnvironment: 'Baja interferencia',
} as const;

export interface ReaderSettings {
  seenTimeoutSec: number;
  repeatReadLogSec: number;
  tagPopulation: number;
  antenna1Enabled: boolean;
  antenna1Power: number;
  antenna2Enabled: boolean;
  antenna2Power: number;
  antenna3Enabled: boolean;
  antenna3Power: number;
  antenna4Enabled: boolean;
  antenna4Power: number;
  portalAlertsEnabled: boolean;
  alertViaGpo: boolean;
  alertGpoPin: number;
  alertGpoDurationSec: number;
  rfSession: string;
  failedTidRetries: number;
  tidWordCount: number;
  readEnvironment: string;
}

export type OperacionSectionId = 'lectura' | 'baliza' | 'antenas' | 'avanzado';

interface Props {
  canEdit: boolean;
  embedded?: boolean;
  /** Modo cascada: muestra solo una subsección */
  section?: OperacionSectionId;
  /** Antena individual (1–4) cuando section === 'antenas' */
  antennaId?: number;
}

function num(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function FieldHint({ children, defaultValue }: { children: ReactNode; defaultValue: string }) {
  return (
    <span className="text-[11px] text-slate-400 leading-snug block">
      {children}{' '}
      <span className="text-slate-500">· Por defecto: {defaultValue}</span>
    </span>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function ToggleRow({
  title,
  subtitle,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  subtitle?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 m-0">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 m-0 mt-0.5">{subtitle}</p>}
      </div>
      <ToggleSwitch
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        label={title}
      />
    </div>
  );
}

export default function ReaderSettingsPanel({
  canEdit,
  embedded = false,
  section,
  antennaId,
}: Props) {
  const [settings, setSettings] = useState<ReaderSettings | null>(null);
  const [baseline, setBaseline] = useState<ReaderSettings | null>(null);
  const settingsRef = useRef(settings);
  const baselineRef = useRef(baseline);
  settingsRef.current = settings;
  baselineRef.current = baseline;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingGpoPin, setTestingGpoPin] = useState<number | null>(null);
  const [gpoOutputs, setGpoOutputs] = useState<Record<number, boolean>>({ ...GPO_OFF_STATE });
  const gpoOutputsRef = useRef(gpoOutputs);
  gpoOutputsRef.current = gpoOutputs;

  const resetAllGpos = useCallback(async () => {
    const active = GPO_PINS.filter((p) => gpoOutputsRef.current[p]);
    setGpoOutputs({ ...GPO_OFF_STATE });
    if (active.length === 0) return;
    await Promise.allSettled(active.map((p) => api.syncTestGpo(p, false)));
  }, []);

  useEffect(() => {
    return () => {
      GPO_PINS.forEach((p) => {
        if (gpoOutputsRef.current[p]) {
          api.syncTestGpo(p, false).catch(() => {});
        }
      });
    };
  }, []);

  useEffect(() => {
    if (section && section !== 'baliza') {
      void resetAllGpos();
    }
  }, [section, resetAllGpos]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [readerConnected, setReaderConnected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getReaderSettings();
      setSettings(r.settings);
      setBaseline(r.settings);
      setReaderConnected(Boolean(r.readerConnected));
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof Error ? e.message : 'No se pudo cargar la configuración',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (partial: Partial<ReaderSettings>) => {
    void resetAllGpos();
    setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const handleSave = useCallback(async (): Promise<boolean> => {
    const current = settingsRef.current;
    if (!current) return false;
    setSaving(true);
    setMessage(null);
    try {
      await resetAllGpos();
      const r = await api.saveReaderSettings(current);
      setSettings(r.settings);
      setBaseline(r.settings);
      setMessage({
        ok: true,
        text: r.readerApplied
          ? 'Configuración guardada y aplicada en el lector.'
          : `Guardada en la PC. Lector: ${r.readerError ?? 'sin conexión'}`,
      });
      return true;
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof Error ? e.message : 'Error al guardar',
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [resetAllGpos]);

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  const unsavedGuard = useMemo(
    () =>
      canEdit
        ? {
            title: 'Operación del lector',
            isDirty: () => {
              const b = baselineRef.current;
              const s = settingsRef.current;
              if (!b || !s) return false;
              return JSON.stringify(s) !== JSON.stringify(b);
            },
            save: () => saveRef.current(),
            discard: () => {
              const b = baselineRef.current;
              if (b) setSettings(structuredClone(b));
              void resetAllGpos();
              setMessage(null);
            },
          }
        : null,
    [canEdit, resetAllGpos]
  );

  useRegisterUnsavedGuard(unsavedGuard);

  const handleToggleGpo = async (pin: number) => {
    const currentlyOn = gpoOutputsRef.current[pin];
    setTestingGpoPin(pin);
    setMessage(null);
    try {
      if (!currentlyOn) {
        await resetAllGpos();
      }
      const nextState = !currentlyOn;
      const r = await api.syncTestGpo(pin, nextState);
      setGpoOutputs({ ...GPO_OFF_STATE, [pin]: nextState });
      if (nextState) {
        setMessage({ ok: true, text: r.message ?? `GPO ${pin} encendido` });
      }
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof Error ? e.message : `Error al cambiar GPO ${pin}`,
      });
    } finally {
      setTestingGpoPin(null);
    }
  };

  const GPO_TEST_PINS = GPO_PINS;
  const ANTENNA_IDS = [1, 2, 3, 4] as const;

  type AntennaField = 'Enabled' | 'Power';
  const antennaField = (n: number, field: AntennaField) =>
    `antenna${n}${field}` as keyof ReaderSettings;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
        <Loader2 size={16} className="animate-spin" />
        Cargando configuración del lector…
      </div>
    );
  }

  if (!settings) {
    return (
      <p className="text-sm text-slate-500 py-4 px-5">No se pudo cargar la configuración del lector.</p>
    );
  }

  const actionButtons = canEdit && (
    <button
      type="button"
      disabled={saving}
      onClick={() => void handleSave()}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 rounded-md bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 cursor-pointer transition-colors"
    >
      {saving ? <Loader2 size={11} className="animate-spin text-slate-400" /> : <Save size={11} className="text-slate-500" />}
      Guardar y aplicar
    </button>
  );

  const statusBar = embedded && (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
      <p className="text-xs text-slate-500 m-0">
        {readerConnected ? (
          <span className="text-emerald-700">Lector conectado</span>
        ) : (
          <span className="text-amber-700">Sin lector — se guarda localmente</span>
        )}
      </p>
      {actionButtons}
    </div>
  );

  const messageBlock = message && (
    <div
      className={`p-3 rounded-lg text-sm border ${
        message.ok
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-red-50 text-red-800 border-red-200'
      }`}
    >
      {message.text}
    </div>
  );

  const lecturaSection = (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
        <ToggleRow
          title="Alertas en pantalla"
          subtitle={
            settings.portalAlertsEnabled
              ? 'Modal y avisos activos en la app web'
              : 'Sin modal ni avisos — el lector sigue registrando'
          }
          checked={settings.portalAlertsEnabled}
          disabled={!canEdit}
          onChange={(v) => patch({ portalAlertsEnabled: v })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.portalAlertsEnabled}>
          Muestra el popup de salida denegada y envía avisos en tiempo real a los usuarios
          conectados. Desactivar no detiene la lectura ni el historial en base de datos.
        </FieldHint>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Segundos entre lectura/alerta del mismo tag</span>
        <input
          type="number"
          min={1}
          max={60}
          step={1}
          disabled={!canEdit}
          className="border border-slate-200 rounded-lg px-3 py-2"
          value={settings.seenTimeoutSec}
          onChange={(e) => patch({ seenTimeoutSec: num(e.target.value, 5) })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.seenTimeoutSec}>
          Intervalo mínimo entre alertas del mismo tag cuando la antena lo vuelve a leer.
          Solo se reporta lo que la antena detecta en tiempo real; sin lectura RFID no hay alerta.
          En pantalla, cada tag se lista una sola vez mientras el modal esté abierto.
        </FieldHint>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Tags estimados en el campo</span>
        <input
          type="number"
          min={1}
          max={512}
          disabled={!canEdit}
          className="border border-slate-200 rounded-lg px-3 py-2"
          value={settings.tagPopulation}
          onChange={(e) => patch({ tagPopulation: num(e.target.value, 64) })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.tagPopulation}>
          Cantidad aproximada de etiquetas que pueden estar frente a las antenas a la vez.
          Subirlo mejora la detección cuando hay muchos tags juntos.
        </FieldHint>
      </label>
    </div>
  );

  const balizaSection = (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
        <ToggleRow
          title="Baliza"
          subtitle={
            settings.alertViaGpo
              ? 'Encendida ante tags no autorizados'
              : 'Desactivada — no se activará ninguna salida GPO'
          }
          checked={settings.alertViaGpo}
          disabled={!canEdit}
          onChange={(v) => patch({ alertViaGpo: v })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.alertViaGpo}>
          Activa o desactiva la baliza física conectada al lector. Si está deshabilitada, no se
          encenderá ninguna salida GPO aunque se detecte un tag no autorizado.
        </FieldHint>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">GPO de alerta (1–4)</span>
        <select
          disabled={!canEdit || !settings.alertViaGpo}
          className="border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-60"
          value={settings.alertGpoPin}
          onChange={(e) => patch({ alertGpoPin: num(e.target.value, 1) })}
        >
          <option value={1}>GPO 1</option>
          <option value={2}>GPO 2</option>
          <option value={3}>GPO 3</option>
          <option value={4}>GPO 4</option>
        </select>
        <FieldHint defaultValue={FIELD_DEFAULTS.alertGpoPin}>
          Pin de salida del lector (baliza, sirena o luz) que se activa en cada alerta de tag no
          autorizado.
        </FieldHint>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Duración encendida (segundos)</span>
        <input
          type="number"
          min={0.5}
          max={60}
          step={0.5}
          disabled={!canEdit || !settings.alertViaGpo}
          className="border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-60"
          value={settings.alertGpoDurationSec}
          onChange={(e) => patch({ alertGpoDurationSec: num(e.target.value, 5) })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.alertGpoDurationSec}>
          Cuánto tiempo permanece encendida la salida GPO en cada alerta antes de apagarse sola.
        </FieldHint>
      </label>
      {canEdit && (
        <div className="pt-1 space-y-2">
          <span className="text-xs font-medium text-slate-600">Probar salidas GPO</span>
          <div className="flex flex-wrap gap-1.5">
            {GPO_TEST_PINS.map((pin) => {
              const isOn = gpoOutputs[pin];
              const isLoading = testingGpoPin === pin;
              return (
                <button
                  key={pin}
                  type="button"
                  aria-pressed={isOn}
                  disabled={isLoading}
                  onClick={() => handleToggleGpo(pin)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-60 ${
                    isOn
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/80'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 size={11} className="animate-spin shrink-0" />
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isOn ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  )}
                  GPO {pin}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 m-0">
            Clic para encender temporalmente. Se apaga solo al editar otra opción o salir de esta
            sección.
          </p>
        </div>
      )}
    </div>
  );

  const renderAntenna = (n: number) => {
    const enabledKey = antennaField(n, 'Enabled');
    const powerKey = antennaField(n, 'Power');
    const enabled = Boolean(settings[enabledKey]);
    const power = Number(settings[powerKey]);
    return (
      <div key={n} className="space-y-3">
        <ToggleRow
          title={`Antena ${n}`}
          subtitle={enabled ? 'Habilitada en el inventario' : 'Ignorada por el lector'}
          checked={enabled}
          disabled={!canEdit}
          onChange={(v) => patch({ [enabledKey]: v })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.antennaEnabled(n)}>
          Si está desactivada, el lector ignora esa antena en el inventario.
        </FieldHint>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Potencia (dBm)</span>
          <input
            type="number"
            min={10}
            max={30}
            step={0.1}
            disabled={!canEdit || !enabled}
            className="border border-slate-200 rounded-lg px-3 py-2 bg-white disabled:opacity-60"
            value={power}
            onChange={(e) => patch({ [powerKey]: num(e.target.value, 27) })}
          />
          <FieldHint defaultValue={FIELD_DEFAULTS.antennaPower}>
            Intensidad de la señal de esa antena. Más dBm = mayor alcance; demasiado alto puede
            generar lecturas cruzadas entre antenas.
          </FieldHint>
        </label>
      </div>
    );
  };

  const antenasSection =
    antennaId != null ? renderAntenna(antennaId) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ANTENNA_IDS.map((n) => (
          <div key={n} className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
            {renderAntenna(n)}
          </div>
        ))}
      </div>
    );

  const avanzadoSection = (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Sesión RF</span>
        <select
          disabled={!canEdit}
          className="border border-slate-200 rounded-lg px-3 py-2"
          value={settings.rfSession}
          onChange={(e) => patch({ rfSession: e.target.value })}
        >
          <option value="S0">S0 (relectura rápida)</option>
          <option value="S1">S1</option>
        </select>
        <FieldHint defaultValue={FIELD_DEFAULTS.rfSession}>
          S0 favorece relecturas rápidas del mismo tag; S1 puede ayudar cuando hay muchos tags
          distintos en el campo.
        </FieldHint>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Reintentos lectura TID</span>
        <input
          type="number"
          min={1}
          max={20}
          disabled={!canEdit}
          className="border border-slate-200 rounded-lg px-3 py-2"
          value={settings.failedTidRetries}
          onChange={(e) => patch({ failedTidRetries: num(e.target.value, 3) })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.failedTidRetries}>
          Veces que el lector reintenta leer el chip (TID) si la primera lectura falla o viene
          incompleta.
        </FieldHint>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Palabras TID a leer</span>
        <input
          type="number"
          min={1}
          max={6}
          disabled={!canEdit}
          className="border border-slate-200 rounded-lg px-3 py-2"
          value={settings.tidWordCount}
          onChange={(e) => patch({ tidWordCount: num(e.target.value, 6) })}
        />
        <FieldHint defaultValue={FIELD_DEFAULTS.tidWordCount}>
          Cantidad de memoria del chip a leer para identificar el tag. Seis palabras suelen ser
          suficientes para la mayoría de etiquetas.
        </FieldHint>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Entorno RF</span>
        <select
          disabled={!canEdit}
          className="border border-slate-200 rounded-lg px-3 py-2"
          value={settings.readEnvironment}
          onChange={(e) => patch({ readEnvironment: e.target.value })}
        >
          <option value="LOW_INTERFERENCE">Baja interferencia</option>
          <option value="HIGH_INTERFERENCE">Alta interferencia</option>
          <option value="AUTO">Auto</option>
        </select>
        <FieldHint defaultValue={FIELD_DEFAULTS.readEnvironment}>
          Perfil de sensibilidad del lector según el ruido RF en la puerta. Use alta interferencia
          si hay muchos lectores o equipos cerca.
        </FieldHint>
      </label>
    </div>
  );

  const sectionContent = section
    ? section === 'lectura'
      ? lecturaSection
      : section === 'baliza'
        ? balizaSection
        : section === 'antenas'
          ? antenasSection
          : avanzadoSection
    : null;

  const formContent = sectionContent ?? (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3">
          <legend className="text-xs font-semibold text-slate-700 px-1">Lectura y alertas por tag</legend>
          {lecturaSection}
        </fieldset>
        <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3">
          <legend className="text-xs font-semibold text-slate-700 px-1">Baliza GPO</legend>
          {balizaSection}
        </fieldset>
        <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3 lg:col-span-2">
          <legend className="text-xs font-semibold text-slate-700 px-1">Antenas (1–4)</legend>
          {antenasSection}
        </fieldset>
        <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3">
          <legend className="text-xs font-semibold text-slate-700 px-1">Avanzado</legend>
          {avanzadoSection}
        </fieldset>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="p-5 flex flex-col min-h-0 h-full">
        {statusBar}
        <div className="flex-1 min-h-0 overflow-y-auto">{formContent}</div>
        {messageBlock && <div className="mt-4 shrink-0">{messageBlock}</div>}
      </div>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 m-0">Operación del lector</h2>
          <p className="text-xs text-slate-500 m-0 mt-1">
            Lecturas, alertas y antenas.{' '}
            {readerConnected ? (
              <span className="text-emerald-700">Lector conectado</span>
            ) : (
              <span className="text-amber-700">Sin lector — se guarda localmente</span>
            )}
          </p>
        </div>
        {actionButtons}
      </div>
      <div className="p-5">{formContent}</div>
    </section>
  );
}

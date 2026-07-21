import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Circle,
  Loader2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Terminal,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import type { FxMonitorSnapshot } from '../types';

type LogLine = {
  id: string;
  text: string;
  kind: 'log' | 'status' | 'error' | 'system' | 'tag_ok' | 'tag_denied';
};

function classifyLogLine(text: string): LogLine['kind'] {
  if (text.includes('LECTURA autorizada') || text.includes('LECTURA OK')) return 'tag_ok';
  if (
    text.includes('LECTURA denegada') ||
    text.includes('TAG no autorizado') ||
    text.includes('ALERTA BALIZA') ||
    text.includes('LECTURA:')
  ) {
    return 'tag_denied';
  }
  return 'log';
}

function formatApiState(reader: FxMonitorSnapshot['reader']) {
  if (!reader) return '—';
  if (!reader.ok) return reader.error ?? 'Sin respuesta';
  const msg = reader.status as { message?: string } | undefined;
  return msg?.message ?? 'API OK';
}

export default function MonitorView({
  embedded = false,
  compact = false,
  active = true,
}: {
  embedded?: boolean;
  compact?: boolean;
  active?: boolean;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [snapshot, setSnapshot] = useState<FxMonitorSnapshot | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminalLabel, setTerminalLabel] = useState('tail -f · conectando…');
  const logEndRef = useRef<HTMLDivElement>(null);
  const lineSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const lastStatusKey = useRef('');
  const lastLogAt = useRef(0);

  const nextLineId = () => {
    lineSeq.current += 1;
    return `L${lineSeq.current}-${Date.now()}`;
  };

  const appendLogText = useCallback((text: string, replace = false) => {
    const trimmed = text.trimEnd();
    if (!trimmed) return;
    const parts = trimmed.split('\n').filter((p) => p.trim());
    if (!parts.length) return;
    setLines((prev) => {
      const base = replace ? [] : prev.slice(-499);
      return [
        ...base,
        ...parts.map((part) => ({
          id: nextLineId(),
          text: part,
          kind: classifyLogLine(part),
        })),
      ];
    });
    lastLogAt.current = Date.now();
  }, []);

  const pushLine = useCallback((text: string, kind: LogLine['kind'] = 'log') => {
    const trimmed = text.trimEnd();
    if (!trimmed) return;
    setLines((prev) => [
      ...prev.slice(-499),
      { id: nextLineId(), text: trimmed, kind },
    ]);
  }, []);

  const applyStatus = useCallback((snap: FxMonitorSnapshot) => {
    setSnapshot(snap);

    const proc = snap.process;
    const allow = snap.allowList;
    const readerOk = snap.reader?.ok || snap.process?.restOk;
    const apiTxt = formatApiState(snap.reader);
    const statusKey = [
      proc?.restOk,
      proc?.running,
      proc?.pid,
      allow?.version,
      allow?.count,
      snap.reader?.ok,
      apiTxt,
    ].join('|');
    if (statusKey !== lastStatusKey.current) {
      lastStatusKey.current = statusKey;
      const statusParts = [
        readerOk || proc?.running
          ? 'Lector conectado'
          : `Lector: ${snap.reader?.error ?? proc?.error ?? '—'}`,
        proc?.running ? `PID ${proc.pid ?? '?'}` : 'app detenida',
        allow?.restOk !== false && allow
          ? `lista v${allow.version} (${allow.count} etiquetas)`
          : allow?.error
            ? `lista: ${allow.error}`
            : null,
      ].filter(Boolean);
      const statusText = `[${new Date(snap.ts).toLocaleTimeString('es-AR')}] ${statusParts.join(' · ')}`;
      setLines((prev) => [
        ...prev.slice(-499),
        { id: nextLineId(), text: statusText, kind: 'status' },
      ]);
    }
  }, []);

  const startStream = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStreamActive(true);
    setError(null);

    api.subscribeSyncMonitor({
      signal: ac.signal,
      onMeta: (meta) => {
        if (meta.message) pushLine(meta.message, 'system');
        if (meta.mode) setTerminalLabel(meta.mode);
        else if (meta.source === 'user-app') setTerminalLabel('tail -f · User App API');
        else if (meta.source === 'ssh') setTerminalLabel('tail -f · SSH');
        if (meta.live) setStreamActive(true);
      },
      onLog: (data) => {
        if (pausedRef.current) return;
        setStreamActive(true);
        appendLogText(data.lines, Boolean(data.tail));
      },
      onStatus: (snap) => {
        if (pausedRef.current || snap.demo) return;
        applyStatus(snap);
      },
      onError: (msg) => {
        setError(msg);
        pushLine(`Error: ${msg}`, 'error');
      },
      onClose: () => {
        const stale = Date.now() - lastLogAt.current > 12_000;
        if (stale) setStreamActive(false);
      },
    });
  }, [appendLogText, applyStatus, pushLine]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!active) return;
    pushLine('Terminal en vivo — abriendo stream del lector…', 'system');
    startStream();
    return () => abortRef.current?.abort();
  }, [active, startStream, pushLine]);

  useEffect(() => {
    if (active) return;
    abortRef.current?.abort();
    setStreamActive(false);
  }, [active]);

  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, autoScroll]);

  const handleClear = () => {
    lastStatusKey.current = '';
    setLines([
      {
        id: nextLineId(),
        text: 'Pantalla limpiada — solo entradas nuevas del stream',
        kind: 'system',
      },
    ]);
  };

  const handleRefresh = async () => {
    try {
      const snap = await api.syncMonitorSnapshot(0);
      applyStatus(snap);
      if (snap.logs?.lines?.trim()) {
        appendLogText(snap.logs.lines);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    }
  };

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-center text-slate-500 text-sm">
        <Terminal className="w-8 h-8 mb-3 opacity-40" />
        <p className="m-0">Ingrese credenciales SSH y pulse Conectar para ver los logs en tiempo real.</p>
      </div>
    );
  }

  const apiOk = snapshot?.reader?.ok ?? snapshot?.process?.restOk;
  const receiving =
    !paused &&
    (streamActive || (lastLogAt.current > 0 && Date.now() - lastLogAt.current < 15_000));

  const badge = (ok: boolean | undefined, labelOk: string, labelBad: string) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
    >
      <Circle className={`w-2 h-2 fill-current ${ok ? 'text-emerald-500' : 'text-red-500'}`} />
      {ok ? labelOk : labelBad}
    </span>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (streamActive && !paused) setPaused(true);
          else {
            setPaused(false);
            if (!streamActive) startStream();
          }
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
      >
        {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        {paused ? 'Reanudar' : 'Pausar'}
      </button>
      <button
        type="button"
        onClick={handleRefresh}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
      >
        <RefreshCw className="w-4 h-4" />
        Estado
      </button>
      <button
        type="button"
        onClick={handleClear}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
      >
        <Trash2 className="w-4 h-4" />
        Limpiar
      </button>
    </div>
  );

  return (
    <div className={`flex flex-col h-full min-h-0 ${compact ? 'gap-3 p-4' : 'gap-4 p-6'}`}>
      {!embedded ? (
        <header className="flex flex-wrap items-start justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-600" />
              Monitor del lector
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Terminal en tiempo real (tail -f)
              {snapshot?.config?.ip ? ` · ${snapshot.config.ip}` : ''}
            </p>
          </div>
          {toolbar}
        </header>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p className={`text-slate-600 m-0 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
            Terminal en vivo
            {snapshot?.config?.ip ? ` · ${snapshot.config.ip}` : ''}
          </p>
          {toolbar}
        </div>
      )}

      <div className="flex flex-wrap gap-2 shrink-0">
        {badge(apiOk, 'Lector', 'Lector')}
        {badge(snapshot?.process?.running, 'Leyendo', 'Detenido')}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            receiving ? 'bg-sky-100 text-sky-800' : paused ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {receiving ? (
            <Activity className="w-3.5 h-3.5" />
          ) : paused ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          {receiving ? 'En vivo' : paused ? 'Pausado' : apiOk ? 'Conectando…' : 'Desconectado'}
        </span>
        {snapshot?.allowList != null && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
            {snapshot.allowList.count} etiquetas · v{snapshot.allowList.version}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-slate-900 overflow-hidden shadow-inner">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            {terminalLabel}
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-slate-600"
            />
            Auto-scroll
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
          {lines.length === 0 ? (
            <p className="text-slate-500">Esperando stream del lector…</p>
          ) : (
            lines.map((line) => (
              <div
                key={line.id}
                className={
                  line.kind === 'error'
                    ? 'text-red-400'
                    : line.kind === 'status'
                      ? 'text-sky-400/90'
                      : line.kind === 'system'
                        ? 'text-amber-400/90'
                        : line.kind === 'tag_ok'
                          ? 'text-emerald-300'
                          : line.kind === 'tag_denied'
                            ? 'text-orange-300'
                            : 'text-emerald-100/90'
                }
              >
                {line.text}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

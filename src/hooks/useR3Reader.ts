import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export type R3Status = {
  ok: boolean;
  bridge?: boolean;
  connected: boolean;
  inventory: boolean;
  state: string;
  lastError?: string | null;
  power?: { ant1: number; ant2: number; ant3: number; ant4: number };
  tagCount?: number;
  cursor?: number;
  javaRequired?: boolean;
  error?: string;
};

type Options = {
  /** Cuando true, conecta e inicia inventario automáticamente. */
  active: boolean;
  /** EPCs nuevos leídos (ya normalizados en mayúsculas). */
  onEpcs?: (epcs: string[]) => void;
};

/**
 * Controla el lector Chainway R3 (USB) vía API local.
 */
export function useR3Reader({ active, onEpcs }: Options) {
  const [status, setStatus] = useState<R3Status>({
    ok: false,
    connected: false,
    inventory: false,
    state: 'DISCONNECTED',
  });
  const [busy, setBusy] = useState(false);
  const [lastEpc, setLastEpc] = useState<string | null>(null);
  const [lastReadAt, setLastReadAt] = useState<number | null>(null);
  const cursorRef = useRef(0);
  const onEpcsRef = useRef(onEpcs);
  onEpcsRef.current = onEpcs;
  const seenRef = useRef(new Set<string>());
  const userDisconnectedRef = useRef(false);
  const sessionRef = useRef(0);
  const activeRef = useRef(active);
  const stopTimerRef = useRef<number | null>(null);
  activeRef.current = active;

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.r3Status();
      setStatus(s);
      return s;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error R3';
      setStatus({
        ok: false,
        connected: false,
        inventory: false,
        state: 'ERROR',
        lastError: message,
        error: message,
      });
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    userDisconnectedRef.current = false;
    try {
      const s = await api.r3Connect();
      setStatus(s);
      if (s.connected) {
        const reading = await api.r3StartInventory();
        setStatus(reading);
        return reading;
      }
      return s;
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    userDisconnectedRef.current = true;
    sessionRef.current += 1;
    try {
      await api.r3StopInventory().catch(() => undefined);
      const s = await api.r3Disconnect();
      setStatus({
        ...s,
        connected: false,
        inventory: false,
        state: 'DISCONNECTED',
        lastError: null,
      });
      return s;
    } finally {
      setBusy(false);
    }
  }, []);

  const startReading = useCallback(async () => {
    if (userDisconnectedRef.current) return status;
    setBusy(true);
    try {
      await api.r3ClearTags().catch(() => undefined);
      cursorRef.current = 0;
      seenRef.current.clear();
      const s = await api.r3StartInventory();
      setStatus(s);
      return s;
    } finally {
      setBusy(false);
    }
  }, [status]);

  const stopReading = useCallback(async () => {
    setBusy(true);
    try {
      const s = await api.r3StopInventory();
      setStatus(s);
      return s;
    } finally {
      setBusy(false);
    }
  }, []);

  const setAntennaPower = useCallback(async (power: number | Partial<R3Status['power']>) => {
    try {
      const body = typeof power === 'number' ? { power } : power;
      const r = await api.r3SetPower(body || {});
      setStatus((prev) => ({
        ...prev,
        power: r.power,
        connected: r.connected ?? prev.connected,
        inventory: r.inventory ?? prev.inventory,
        lastError: r.lastError ?? null,
      }));
      return r;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al aplicar potencia';
      setStatus((prev) => ({ ...prev, lastError: message }));
      throw err;
    }
  }, []);

  /** Forget TID(s) so the reader can report them again if still in the field. */
  const forgetTids = useCallback(async (tids: string | string[]) => {
    const list = (Array.isArray(tids) ? tids : [tids])
      .map((t) => String(t || '').trim().toUpperCase())
      .filter(Boolean);
    for (const t of list) seenRef.current.delete(t);
    await api.r3ForgetTags(list).catch(() => undefined);
  }, []);

  // Auto connect + inventory while on step 1.
  // Important: do NOT stop inventory on effect cleanup (React Strict Mode remount
  // was connecting then immediately stopping / racing disconnect).
  useEffect(() => {
    if (!active) {
      // Left the page/step: stop reading but keep USB session unless user asked disconnect.
      if (!userDisconnectedRef.current) {
        void api.r3StopInventory().catch(() => undefined);
      }
      return;
    }

    if (userDisconnectedRef.current) return;

    const session = ++sessionRef.current;
    let cancelled = false;

    (async () => {
      try {
        setBusy(true);
        await api.r3ClearTags().catch(() => undefined);
        cursorRef.current = 0;
        seenRef.current.clear();
        const s = await api.r3StartInventory();
        if (!cancelled && session === sessionRef.current && !userDisconnectedRef.current) {
          setStatus(s);
        }
      } catch (err) {
        if (!cancelled && session === sessionRef.current && !userDisconnectedRef.current) {
          const message = err instanceof Error ? err.message : 'Error R3';
          // Refresh real bridge status — do not force "Desconectado" if USB is still up.
          try {
            const live = await api.r3Status();
            setStatus({
              ...live,
              lastError: live.connected ? message : live.lastError || message,
              error: message,
            });
          } catch {
            setStatus({
              ok: false,
              connected: false,
              inventory: false,
              state: 'ERROR',
              lastError: message,
              error: message,
            });
          }
        }
      } finally {
        if (!cancelled && session === sessionRef.current) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      // Do not call stop/disconnect here — Strict Mode would tear down a good session.
    };
  }, [active]);

  // Poll tags + status.
  useEffect(() => {
    if (!active) return;

    let stopped = false;
    const tick = async () => {
      if (stopped || userDisconnectedRef.current || !activeRef.current) return;
      try {
        const data = await api.r3Tags(cursorRef.current);
        if (typeof data.cursor === 'number') cursorRef.current = data.cursor;
        const tags = data.tags || [];
        const fresh: string[] = [];
        for (const t of tags) {
          const tid = String(t.tid || t.epc || '')
            .trim()
            .toUpperCase();
          if (!tid || seenRef.current.has(tid)) continue;
          seenRef.current.add(tid);
          fresh.push(tid);
          setLastEpc(tid);
          setLastReadAt(Date.now());
        }
        if (fresh.length) {
          onEpcsRef.current?.(fresh);
        }
      } catch {
        /* ignore */
      }
      try {
        const s = await api.r3Status();
        if (!stopped && !userDisconnectedRef.current) setStatus(s);
      } catch {
        /* ignore */
      }
    };

    // Delay first poll so connect/inventory can finish without racing.
    const startId = window.setTimeout(() => void tick(), 800);
    const id = window.setInterval(() => void tick(), 800);
    return () => {
      stopped = true;
      window.clearTimeout(startId);
      window.clearInterval(id);
    };
  }, [active]);

  // On real unmount (leave page), stop inventory — delayed so React Strict Mode
  // remount does not tear down a healthy session.
  useEffect(() => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    return () => {
      stopTimerRef.current = window.setTimeout(() => {
        void api.r3StopInventory().catch(() => undefined);
      }, 600);
    };
  }, []);

  return {
    status,
    busy,
    lastEpc,
    lastReadAt,
    refreshStatus,
    connect,
    disconnect,
    startReading,
    stopReading,
    setAntennaPower,
    forgetTids,
  };
}

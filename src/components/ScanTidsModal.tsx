import { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, X, Trash2, Check, Loader2, Plus } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  open: boolean;
  mockEnabled?: boolean;
  initialTids?: string[];
  onClose: () => void;
  onConfirm: (tids: string[]) => void;
}

export default function ScanTidsModal({
  open,
  mockEnabled = false,
  initialTids = [],
  onClose,
  onConfirm,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const [tids, setTids] = useState<string[]>([]);
  const [manualTid, setManualTid] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopScan = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setScanning(false);
  }, []);

  const addTid = useCallback((raw: string) => {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) return false;
    setTids((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    return true;
  }, []);

  const startScan = useCallback(() => {
    if (!mockEnabled) return;
    stopScan();
    setScanning(true);

    const poll = async () => {
      try {
        const { tid } = await api.mockScanOne();
        addTid(tid);
      } catch {
        /* ignore transient errors while demo polling */
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 600 + Math.random() * 400);
  }, [addTid, mockEnabled, stopScan]);

  useEffect(() => {
    if (open) {
      setTids(initialTids.map((t) => t.trim().toUpperCase()).filter(Boolean));
      setManualTid('');
      if (mockEnabled) startScan();
      else stopScan();
    } else {
      stopScan();
    }
    return () => stopScan();
  }, [open, mockEnabled, initialTids, startScan, stopScan]);

  if (!open) return null;

  const handleConfirm = () => {
    stopScan();
    onConfirm(tids);
    onClose();
  };

  const handleAddManual = () => {
    if (addTid(manualTid)) setManualTid('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0">Lectura de etiquetas</h2>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              {mockEnabled ? 'Modo demo — lector R3 simulado' : 'Modo manual — ingrese cada TID'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScan();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {mockEnabled ? (
          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-b from-blue-50/80 to-white">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  scanning ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {scanning ? (
                  <Radio size={26} className="animate-pulse" />
                ) : (
                  <Check size={26} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 m-0">
                  {scanning ? 'Esperando la lectura de etiquetas…' : 'Lectura detenida'}
                </p>
                <p className="text-xs text-slate-500 m-0 mt-1">
                  Acerque las etiquetas al lector. Los TID se agregan sin duplicar.
                </p>
              </div>
              <div className="text-center shrink-0">
                <div className="text-3xl font-bold font-mono text-blue-600 leading-none">{tids.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-1">
                  leídas
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              TID
            </label>
            <div className="flex gap-2">
              <input
                value={manualTid}
                onChange={(e) => setManualTid(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManual();
                  }
                }}
                placeholder="E280119420000F6A1C5A6014"
                className="flex-1 py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
              <button
                type="button"
                onClick={handleAddManual}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                <Plus size={16} />
                Agregar
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[320px]">
          {tids.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              {mockEnabled && scanning && (
                <Loader2 size={28} className="animate-spin text-blue-400" />
              )}
              <p className="text-sm m-0">
                {mockEnabled
                  ? scanning
                    ? 'Buscando etiquetas…'
                    : 'No se leyeron etiquetas'
                  : 'Agregue TID manualmente'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-6 py-2.5 text-[11px] font-bold text-slate-500 uppercase w-10">
                    #
                  </th>
                  <th className="text-left px-2 py-2.5 text-[11px] font-bold text-slate-500 uppercase">
                    TID
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tids.map((tid, i) => (
                  <tr key={tid} className="hover:bg-slate-50/80 group">
                    <td className="px-6 py-2.5 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-2 py-2.5 font-mono text-[13px] text-slate-800">{tid}</td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => setTids((prev) => prev.filter((t) => t !== tid))}
                        className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                        title="Quitar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-2 justify-end">
          {mockEnabled &&
            (scanning ? (
              <button
                type="button"
                onClick={stopScan}
                className="px-4 py-2.5 border border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Detener lectura
              </button>
            ) : (
              <button
                type="button"
                onClick={startScan}
                className="px-4 py-2.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-100 cursor-pointer flex items-center gap-2"
              >
                <Radio size={16} />
                Reanudar lectura
              </button>
            ))}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={tids.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-2"
          >
            <Check size={16} />
            Confirmar {tids.length > 0 ? `(${tids.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

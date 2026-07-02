import { useEffect, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Radio,
  Save,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import MonitorView from './MonitorView';

interface Props {
  canEdit?: boolean;
  showMonitor?: boolean;
}

type ConnectionState = 'checking' | 'connected' | 'disconnected';

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 text-right break-all">{value}</span>
    </div>
  );
}

export default function Fx9600ConnectionPanel({ canEdit = true, showMonitor = true }: Props) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [ip, setIp] = useState('');
  const [appPort, setAppPort] = useState('8765');
  const [user, setUser] = useState('admin');
  const [password, setPassword] = useState('');
  const [probing, setProbing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [tagCount, setTagCount] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const demoMode = config.demo_mode === 'true';
  const hasSavedPassword = Boolean(config.fx9600_password);

  const refreshStatus = async (savedConfig?: Record<string, string>) => {
    const c = savedConfig ?? config;
    if (c.demo_mode === 'true') return;
    setConnectionState('checking');
    try {
      const st = await api.syncStatus();
      if (st.connected) {
        setConnectionState('connected');
        setTagCount(st.appStatus?.count ?? null);
      } else {
        setConnectionState('disconnected');
        setTagCount(null);
      }
    } catch {
      setConnectionState('disconnected');
      setTagCount(null);
    }
  };

  const applyConfigToForm = (c: Record<string, string>) => {
    setIp(c.fx9600_ip ?? '169.254.240.149');
    setAppPort(c.fx9600_app_port ?? '8765');
    setUser(c.fx9600_user ?? 'admin');
    setPassword('');
  };

  const loadMeta = async () => {
    const c = await api.getConfig();
    setConfig(c);
    applyConfigToForm(c);
    await refreshStatus(c);
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const cancelEdit = () => {
    applyConfigToForm(config);
    setEditing(false);
    setResult(null);
  };

  const saveConnection = async () => {
    if (!hasSavedPassword && !password.trim()) {
      setResult({
        ok: false,
        message: 'Ingresá la contraseña de administrador del lector.',
      });
      return;
    }

    setSaving(true);
    setResult(null);
    try {
      const r = await api.syncConfig({
        ip,
        appPort: Number(appPort) || 8765,
        user,
        password: password || undefined,
      });

      if (r.credentialsPush && !r.credentialsPush.ok) {
        setResult({
          ok: false,
          message: r.credentialsPush.error ?? 'No pudimos enviar las credenciales al lector.',
        });
        await loadMeta();
        return;
      }

      setResult({ ok: true, message: 'Configuración guardada correctamente.' });
      setPassword('');
      setEditing(false);
      await loadMeta();
    } finally {
      setSaving(false);
    }
  };

  const handleProbe = async () => {
    setProbing(true);
    setResult(null);
    setConnectionState('checking');
    try {
      const r = await api.syncProbe({
        ip,
        appPort: Number(appPort) || 8765,
        user,
        password: password || undefined,
      });

      if (r.ok) {
        setResult({
          ok: true,
          message: `Conexión exitosa en ${r.ip}:${r.appPort ?? appPort}.`,
        });
        await loadMeta();
      } else {
        setConnectionState('disconnected');
        setResult({
          ok: false,
          message:
            r.message ??
            r.error ??
            'No pudimos comunicarnos con el lector. Revisá la IP, el puerto y que esté encendido.',
        });
      }
    } catch (e) {
      setConnectionState('disconnected');
      setResult({
        ok: false,
        message: e instanceof Error ? e.message : 'Error al comprobar la conexión.',
      });
    } finally {
      setProbing(false);
    }
  };

  if (demoMode) {
    return (
      <div className="h-full">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold m-0">Modo demostración activo</p>
          <p className="m-0 mt-1 text-amber-800">
            No hay lector físico conectado. Podés probar el resto de la aplicación con datos simulados.
          </p>
        </div>
      </div>
    );
  }

  const statusLabel =
    connectionState === 'checking'
      ? 'Verificando…'
      : connectionState === 'connected'
        ? 'Conectado'
        : 'Sin conexión';

  const statusClass =
    connectionState === 'checking'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : connectionState === 'connected'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-red-50 text-red-800 border-red-200';

  const StatusDot = () => (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${statusClass}`}
    >
      {connectionState === 'checking' ? (
        <Loader2 size={11} className="animate-spin" />
      ) : connectionState === 'connected' ? (
        <Wifi size={11} />
      ) : (
        <WifiOff size={11} />
      )}
      {statusLabel}
    </span>
  );

  const readerCard = (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Radio size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 m-0">Lector Zebra FX9600</h2>
            <div className="mt-1">
              <StatusDot />
            </div>
          </div>
        </div>

        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Pencil size={14} />
            Editar
          </button>
        )}
        {canEdit && editing && (
          <button
            type="button"
            onClick={cancelEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <X size={14} />
            Cancelar
          </button>
        )}
      </div>

      <div className="p-5">
        {!editing ? (
          <div>
            <SummaryRow
              label="Estado"
              value={
                connectionState === 'connected' && tagCount != null
                  ? `${statusLabel} · ${tagCount} etiqueta${tagCount === 1 ? '' : 's'} cargadas`
                  : statusLabel
              }
            />
            <SummaryRow label="Dirección IP" value={ip || '—'} />
            <SummaryRow label="Puerto" value={appPort || '—'} />
            <SummaryRow label="Usuario admin" value={user || '—'} />
            <SummaryRow
              label="Contraseña"
              value={
                hasSavedPassword ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 size={13} />
                    Configurada
                  </span>
                ) : (
                  <span className="text-amber-700">No configurada</span>
                )
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Dirección IP</span>
                <input
                  className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="169.254.240.149"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Puerto</span>
                <input
                  className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={appPort}
                  onChange={(e) => setAppPort(e.target.value)}
                  placeholder="8765"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Usuario admin</span>
                <input
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Contraseña</span>
                <input
                  type="password"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    hasSavedPassword ? 'Dejar vacío para mantener la actual' : 'Contraseña del lector'
                  }
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={probing || !ip.trim()}
                onClick={handleProbe}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                {probing ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
                Comprobar conexión
              </button>
              <button
                type="button"
                disabled={saving || !ip.trim()}
                onClick={saveConnection}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Guardar
              </button>
            </div>
          </div>
        )}

        {result && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              result.ok
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
    </section>
  );

  const monitorColumn = showMonitor ? (
    <div className="min-h-0 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
      <MonitorView embedded compact />
    </div>
  ) : null;

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={`flex-1 min-h-0 grid gap-6 ${
          showMonitor
            ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]'
            : 'grid-cols-1'
        }`}
      >
        <div className="min-h-0 overflow-y-auto">{readerCard}</div>
        {monitorColumn}
      </div>
    </div>
  );
}

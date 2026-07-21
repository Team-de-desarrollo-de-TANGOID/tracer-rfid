import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Loader2,
  Wifi,
  WifiOff,
  LogIn,
  LogOut,
  RefreshCw,
  Square,
  Play,
} from 'lucide-react';
import { api } from '../api/client';
import MonitorView from './MonitorView';
import ReaderSettingsPanel, { type OperacionSectionId } from './ReaderSettingsPanel';
import { CascadeColumn, CascadeItem } from './CascadeNav';
import { useUnsavedChanges } from '../context/UnsavedChangesContext';
import { PermAction, usePerm } from './PermAction';
import { P } from '../constants/permissions';

interface Props {
  showMonitor?: boolean;
}

type PanelId = 'estado' | 'monitor' | 'operacion';
type EstadoSubId = 'resumen';
type MonitorSubId = 'conexion' | 'logs';

const OPERACION_SUBS: { id: OperacionSectionId; title: string; subtitle: string }[] = [
  { id: 'lectura', title: 'Lectura y alertas', subtitle: 'Dedupe y popup en pantalla' },
  { id: 'baliza', title: 'Baliza GPO', subtitle: 'Salida física y prueba' },
  { id: 'antenas', title: 'Antenas', subtitle: 'Habilitación y potencia' },
  { id: 'avanzado', title: 'Avanzado', subtitle: 'Sesión RF y entorno' },
];

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 text-right break-all">{value}</span>
    </div>
  );
}

export default function Fx9600ConnectionPanel({ showMonitor = true }: Props) {
  const { allowed: canSync } = usePerm(P.syncEjecutar);
  const canEdit = canSync;
  const [config, setConfig] = useState<Record<string, string>>({});
  const [ip, setIp] = useState('');
  const [appPort, setAppPort] = useState('8765');
  const [appVersion, setAppVersion] = useState('');
  const [appPid, setAppPid] = useState<string | null>(null);
  const [tagCount, setTagCount] = useState<number | null>(null);
  const [reachable, setReachable] = useState(false);
  const [appAuthenticated, setAppAuthenticated] = useState(false);
  const [portalWebhookUrl, setPortalWebhookUrl] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);

  const [sshUser, setSshUser] = useState('rfidadm');
  const [sshPassword, setSshPassword] = useState('');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [monitorActive, setMonitorActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [appAction, setAppAction] = useState<'stop' | 'start' | null>(null);
  const [appActionResult, setAppActionResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [activePanel, setActivePanel] = useState<PanelId>('estado');
  const [estadoSub, setEstadoSub] = useState<EstadoSubId>('resumen');
  const [monitorSub, setMonitorSub] = useState<MonitorSubId>('conexion');
  const [operacionSub, setOperacionSub] = useState<OperacionSectionId>('lectura');
  const [antennaId, setAntennaId] = useState<number | null>(null);

  const { requestLeave } = useUnsavedChanges();

  const guarded = (action: () => void) => requestLeave(action);

  const selectPanel = (id: PanelId) => {
    if (id === activePanel) return;
    guarded(() => {
      setActivePanel(id);
      if (id === 'estado') setEstadoSub('resumen');
      if (id === 'monitor') setMonitorSub(monitorActive ? 'logs' : 'conexion');
      if (id === 'operacion') {
        setOperacionSub('lectura');
        setAntennaId(null);
      }
    });
  };

  const selectOperacionSub = (sub: OperacionSectionId) => {
    if (activePanel === 'operacion' && operacionSub === sub && sub !== 'antenas') return;
    guarded(() => {
      setOperacionSub(sub);
      setAntennaId(sub === 'antenas' ? 1 : null);
    });
  };

  const selectMonitorSub = (sub: MonitorSubId) => {
    if (sub === 'logs' && !monitorActive) return;
    if (activePanel === 'monitor' && monitorSub === sub) return;
    guarded(() => setMonitorSub(sub));
  };

  const demoMode = config.demo_mode === 'true';
  const hasSavedAdminPassword = Boolean(config.fx9600_password);

  const refreshStatus = useCallback(async () => {
    if (demoMode) return;
    setStatusLoading(true);
    try {
      const st = await api.syncStatus();
      if (st.portalWebhookUrl) setPortalWebhookUrl(st.portalWebhookUrl);

      const health = st.health;
      const cfgIp =
        (health?.ip as string) ||
        (st.config && typeof st.config === 'object' ? String(st.config.ip ?? '') : '') ||
        ip;

      if (cfgIp) setIp(cfgIp);
      setReachable(Boolean(st.reachable ?? health?.ok));
      setAppAuthenticated(Boolean(st.appAuthenticated ?? st.appOk));
      setAppVersion(String(health?.version ?? st.appStatus?.appVersion ?? ''));
      setAppPid(health?.pid != null ? String(health.pid) : st.appStatus?.pid != null ? String(st.appStatus.pid) : null);
      setTagCount(st.appOk ? (st.appStatus?.count ?? null) : null);
    } catch {
      setReachable(false);
      setAppAuthenticated(false);
      setTagCount(null);
    } finally {
      setStatusLoading(false);
    }
  }, [demoMode, ip]);

  useEffect(() => {
    (async () => {
      const c = await api.getConfig();
      setConfig(c);
      setIp(c.fx9600_ip ?? '');
      setAppPort(c.fx9600_app_port ?? '8765');
      setAdminUser(c.fx9600_user ?? 'admin');
      setSshUser(c.fx9600_ssh_user ?? 'rfidadm');
      setPortalWebhookUrl(c.portal_webhook_url ?? '');
      await refreshStatus();
    })();
    const timer = setInterval(refreshStatus, 20_000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  useEffect(() => {
    if (!showMonitor && activePanel === 'monitor') {
      guarded(() => setActivePanel('estado'));
    }
  }, [showMonitor, activePanel]);

  const handleReconnect = async () => {
    setReconnecting(true);
    setReconnectResult(null);
    try {
      const r = await api.syncProbe();
      if (r.ok) {
        setReconnectResult({
          ok: true,
          message: r.message ?? `Lector conectado en ${r.ip}:${r.appPort ?? appPort}`,
        });
      } else {
        setReconnectResult({
          ok: false,
          message: r.error ?? 'No se encontró el lector en la red.',
        });
      }
      await refreshStatus();
    } catch (e) {
      setReconnectResult({
        ok: false,
        message: e instanceof Error ? e.message : 'Error al reconectar',
      });
      await refreshStatus();
    } finally {
      setReconnecting(false);
    }
  };

  const handleStopApp = async () => {
    setAppAction('stop');
    setAppActionResult(null);
    try {
      const r = await api.stopGateApp({
        sshUser,
        ...(sshPassword.trim() ? { sshPassword } : {}),
        ...(adminPassword.trim() ? { adminPassword, adminUser } : {}),
      });
      const detail = r.steps?.length ? ` (${r.steps.join(', ')})` : '';
      setAppActionResult({
        ok: r.ok,
        message: (r.message ?? (r.ok ? 'User App detenida.' : 'No se pudo detener la User App.')) + detail,
      });
      if (r.ok) {
        setMonitorActive(false);
        setMonitorSub('conexion');
      }
      await refreshStatus();
    } catch (e) {
      setAppActionResult({
        ok: false,
        message: e instanceof Error ? e.message : 'Error al detener la User App',
      });
      await refreshStatus();
    } finally {
      setAppAction(null);
    }
  };

  const handleStartApp = async () => {
    setAppAction('start');
    setAppActionResult(null);
    try {
      const r = await api.startGateApp({
        sshUser,
        ...(sshPassword.trim() ? { sshPassword } : {}),
      });
      setAppActionResult({
        ok: r.ok,
        message: r.message ?? (r.ok ? 'User App iniciada.' : 'No se pudo iniciar la User App.'),
      });
      await refreshStatus();
    } catch (e) {
      setAppActionResult({
        ok: false,
        message: e instanceof Error ? e.message : 'Error al iniciar la User App',
      });
      await refreshStatus();
    } finally {
      setAppAction(null);
    }
  };

  const handleMonitorConnect = async () => {
    if (!sshPassword.trim()) {
      setConnectResult({ ok: false, message: 'Ingrese la contraseña SSH del lector (usuario rfidadm).' });
      return;
    }
    if (!adminPassword.trim() && !hasSavedAdminPassword) {
      setConnectResult({ ok: false, message: 'Ingrese la contraseña admin del lector Zebra.' });
      return;
    }

    setConnecting(true);
    setConnectResult(null);
    try {
      const r = await api.monitorConnect({
        sshUser,
        sshPassword,
        adminUser,
        ...(adminPassword.trim() ? { adminPassword } : {}),
      });

      if (!r.ok) {
        setConnectResult({ ok: false, message: r.error ?? 'No se pudo conectar.' });
        setMonitorActive(false);
        return;
      }

      setConnectResult({
        ok: true,
        message:
          r.message ??
          `Conectado en ${r.ip}. ${r.deploy?.skipped ? 'User App ya actualizada.' : 'Deploy completado.'}`,
      });
      setAdminPassword('');
      setMonitorActive(true);
      setMonitorSub('logs');
      await refreshStatus();
    } catch (e) {
      setConnectResult({
        ok: false,
        message: e instanceof Error ? e.message : 'Error al conectar',
      });
      setMonitorActive(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleMonitorDisconnect = async () => {
    await api.monitorDisconnect().catch(() => {});
    setMonitorActive(false);
    setMonitorSub('conexion');
    setConnectResult({ ok: true, message: 'Monitor desconectado.' });
  };

  if (demoMode) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold m-0">Modo demostración activo</p>
        <p className="m-0 mt-1 text-amber-800">No hay lector físico conectado.</p>
      </div>
    );
  }

  const statusLabel = statusLoading
    ? 'Consultando…'
    : appAuthenticated
      ? 'API vinculada'
      : reachable
        ? 'App alcanzable'
        : 'Sin respuesta';

  const statusClass = statusLoading
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : appAuthenticated
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : reachable
        ? 'bg-sky-50 text-sky-800 border-sky-200'
        : 'bg-red-50 text-red-800 border-red-200';

  const estadoSubtitle = ip ? `${ip}:${appPort}` : 'Sin dirección configurada';

  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (activePanel === 'estado') {
      parts.push('Estado', 'Resumen');
    } else if (activePanel === 'monitor') {
      parts.push('Monitor', monitorSub === 'logs' ? 'Logs en vivo' : 'Conexión');
    } else {
      const sub = OPERACION_SUBS.find((s) => s.id === operacionSub);
      parts.push('Operación', sub?.title ?? operacionSub);
      if (operacionSub === 'antenas' && antennaId != null) {
        parts.push(`Antena ${antennaId}`);
      }
    }
    return parts;
  }, [activePanel, monitorSub, operacionSub, antennaId]);

  const contentMeta = useMemo(() => {
    if (activePanel === 'estado') {
      return {
        title: 'Resumen del lector',
        description: 'Conexión, versión de la User App y webhook de alertas.',
      };
    }
    if (activePanel === 'monitor') {
      return monitorSub === 'logs'
        ? { title: 'Logs en vivo', description: 'Salida del lector en tiempo real.' }
        : { title: 'Conexión SSH', description: 'Credenciales para deploy y acceso al monitor.' };
    }
    const sub = OPERACION_SUBS.find((s) => s.id === operacionSub);
    if (operacionSub === 'antenas' && antennaId != null) {
      return {
        title: `Antena ${antennaId}`,
        description: 'Habilitación y potencia de esta antena.',
      };
    }
    return {
      title: sub?.title ?? 'Operación',
      description: sub?.subtitle ?? 'Parámetros del lector.',
    };
  }, [activePanel, monitorSub, operacionSub, antennaId]);

  const monitorLogsMode = activePanel === 'monitor' && monitorSub === 'logs' && monitorActive;

  const estadoContent = (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 m-0">
          Busca el lector en la red, actualiza credenciales y webhook de alertas.
        </p>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {appAuthenticated || reachable ? (
            <PermAction
              permission={P.syncControlApp}
              disabled={appAction !== null || statusLoading}
              onClick={() => void handleStopApp()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {appAction === 'stop' ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Square size={11} />
              )}
              Detener app
            </PermAction>
          ) : (
            <PermAction
              permission={P.syncControlApp}
              disabled={appAction !== null || statusLoading}
              onClick={() => void handleStartApp()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 rounded-md bg-white hover:bg-emerald-50 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {appAction === 'start' ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Play size={11} />
              )}
              Iniciar app
            </PermAction>
          )}
          <PermAction
            permission={P.syncEjecutar}
            disabled={reconnecting || statusLoading}
            onClick={() => void handleReconnect()}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 rounded-md bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {reconnecting ? (
              <Loader2 size={11} className="animate-spin text-slate-400" />
            ) : (
              <RefreshCw size={11} className="text-slate-500" />
            )}
            Reconectar
          </PermAction>
        </div>
      </div>

      <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
        <SummaryRow label="Dirección" value={ip ? `${ip}:${appPort}` : '—'} />
        <SummaryRow label="User App" value={appVersion || '—'} />
        <SummaryRow label="PID" value={appPid ?? '—'} />
        <SummaryRow
          label="Lista local"
          value={
            tagCount != null
              ? `${tagCount} etiqueta${tagCount === 1 ? '' : 's'}`
              : reachable
                ? 'Requiere vincular API'
                : '—'
          }
        />
        <SummaryRow label="Alertas → PC" value={portalWebhookUrl || '—'} />
        <SummaryRow
          label="Monitor en vivo"
          value={
            monitorActive ? (
              <span className="text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 size={13} /> Conectado
              </span>
            ) : (
              <span className="text-slate-500">No conectado</span>
            )
          }
        />
      </div>

      {canSync && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Contraseña SSH (rfidadm)</span>
            <input
              type="password"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={sshPassword}
              onChange={(e) => setSshPassword(e.target.value)}
              placeholder="Necesaria para detener instancias huérfanas"
            />
          </label>
          <p className="text-[11px] text-slate-400 m-0 sm:col-span-2">
            Si Stop en Zebra no funciona, suele ser AutoStart activo o una copia iniciada por SSH.
            Ingrese la contraseña SSH y use Detener app, o desmarque AutoStart en Applications.
          </p>
        </div>
      )}

      {reconnectResult && (
        <div
          className={`p-3 rounded-lg text-xs border ${
            reconnectResult.ok
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {reconnectResult.message}
        </div>
      )}

      {appActionResult && (
        <div
          className={`p-3 rounded-lg text-xs border ${
            appActionResult.ok
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {appActionResult.message}
        </div>
      )}

    </div>
  );

  const monitorConexionContent = (
    <div className="p-5 space-y-4">
      <p className="text-xs text-slate-500 m-0">
        Credenciales SSH para deploy y logs. Se actualiza la User App automáticamente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Usuario SSH</span>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm"
            value={sshUser}
            onChange={(e) => setSshUser(e.target.value)}
            placeholder="rfidadm"
            disabled={!canEdit}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Contraseña SSH *</span>
          <input
            type="password"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={sshPassword}
            onChange={(e) => setSshPassword(e.target.value)}
            placeholder="Contraseña de rfidadm"
            disabled={!canEdit}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Usuario admin Zebra</span>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={adminUser}
            onChange={(e) => setAdminUser(e.target.value)}
            disabled={!canEdit}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Contraseña admin *</span>
          <input
            type="password"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder={
              hasSavedAdminPassword ? 'Dejar vacío si ya está guardada' : 'Contraseña web del lector'
            }
            disabled={!canEdit}
          />
        </label>
      </div>

      <PermAction
        permission={P.syncEjecutar}
        disabled={connecting}
        onClick={handleMonitorConnect}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
      >
        {connecting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        Conectar y ver logs
      </PermAction>

      {connectResult && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            connectResult.ok
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {connectResult.message}
        </div>
      )}
    </div>
  );

  const monitorLogsContent = (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="px-4 py-2 border-b border-slate-100 flex justify-end shrink-0">
        <PermAction
          permission={P.syncEjecutar}
          onClick={handleMonitorDisconnect}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer"
        >
          <LogOut size={14} />
          Desconectar
        </PermAction>
      </div>
      <div className="flex-1 min-h-0">
        <MonitorView embedded compact active />
      </div>
    </div>
  );

  const visibleContent =
    activePanel === 'estado'
      ? estadoContent
      : activePanel === 'monitor'
        ? monitorSub === 'logs' && monitorActive
          ? monitorLogsContent
          : monitorConexionContent
        : null;

  const showAntennaColumn = activePanel === 'operacion' && operacionSub === 'antenas';

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden">
        <CascadeColumn title="Sección" className="w-[min(100%,168px)]">
          <CascadeItem
            title="Estado"
            subtitle={estadoSubtitle}
            selected={activePanel === 'estado'}
            hasChildren
            onSelect={() => selectPanel('estado')}
          />
          {showMonitor && (
            <CascadeItem
              title="Monitor"
              subtitle={monitorActive ? 'Conectado' : 'SSH y logs'}
              selected={activePanel === 'monitor'}
              hasChildren
              onSelect={() => selectPanel('monitor')}
            />
          )}
          <CascadeItem
            title="Operación"
            subtitle="Lectura, GPO, antenas"
            selected={activePanel === 'operacion'}
            hasChildren
            onSelect={() => selectPanel('operacion')}
          />
        </CascadeColumn>

        {activePanel === 'estado' && (
          <CascadeColumn title="Estado" className="w-[min(100%,168px)]">
            <CascadeItem
              title="Resumen"
              subtitle={statusLabel}
              selected={estadoSub === 'resumen'}
              onSelect={() => guarded(() => setEstadoSub('resumen'))}
            />
          </CascadeColumn>
        )}

        {activePanel === 'monitor' && (
          <CascadeColumn title="Monitor" className="w-[min(100%,168px)]">
            <CascadeItem
              title="Conexión"
              subtitle="Credenciales SSH"
              selected={monitorSub === 'conexion'}
              onSelect={() => selectMonitorSub('conexion')}
            />
            <CascadeItem
              title="Logs en vivo"
              subtitle={monitorActive ? 'Stream activo' : 'Requiere conexión'}
              selected={monitorSub === 'logs'}
              disabled={!monitorActive}
              hasChildren={monitorActive}
              onSelect={() => selectMonitorSub('logs')}
            />
          </CascadeColumn>
        )}

        {activePanel === 'operacion' && (
          <CascadeColumn title="Operación" className="w-[min(100%,168px)]">
            {OPERACION_SUBS.map((sub) => (
              <CascadeItem
                key={sub.id}
                title={sub.title}
                subtitle={sub.subtitle}
                selected={operacionSub === sub.id}
                hasChildren={sub.id === 'antenas'}
                onSelect={() => selectOperacionSub(sub.id)}
              />
            ))}
          </CascadeColumn>
        )}

        {showAntennaColumn && (
          <CascadeColumn title="Antena" className="w-[min(100%,140px)]">
            {[1, 2, 3, 4].map((n) => (
              <CascadeItem
                key={n}
                title={`Antena ${n}`}
                selected={antennaId === n}
                onSelect={() => guarded(() => setAntennaId(n))}
              />
            ))}
          </CascadeColumn>
        )}

        <section className="flex-1 min-w-[240px] min-h-0 flex flex-col overflow-hidden">
          <header className="px-5 py-3 border-b border-slate-100 shrink-0">
            <p className="text-[11px] text-slate-400 m-0 flex flex-wrap items-center gap-1">
              {breadcrumb.map((part, i) => (
                <span key={`${part}-${i}`} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-slate-300">/</span>}
                  <span className={i === breadcrumb.length - 1 ? 'text-slate-600 font-medium' : ''}>
                    {part}
                  </span>
                </span>
              ))}
            </p>
            <h2 className="text-base font-bold text-slate-900 m-0 mt-1">{contentMeta.title}</h2>
            <p className="text-xs text-slate-500 m-0 mt-0.5">{contentMeta.description}</p>
            {activePanel === 'estado' && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border mt-2 ${statusClass}`}
              >
                {statusLoading ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : appAuthenticated ? (
                  <Wifi size={11} />
                ) : (
                  <WifiOff size={11} />
                )}
                {statusLabel}
              </span>
            )}
          </header>
          <div
            className={`flex-1 min-h-0 ${
              monitorLogsMode ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
            }`}
          >
            {visibleContent}
            <div
              className={activePanel === 'operacion' ? 'min-h-0 h-full' : 'hidden'}
              aria-hidden={activePanel !== 'operacion'}
            >
              <ReaderSettingsPanel
                canEdit={canEdit}
                embedded
                section={operacionSub}
                antennaId={operacionSub === 'antenas' ? (antennaId ?? undefined) : undefined}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

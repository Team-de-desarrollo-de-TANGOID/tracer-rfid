import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  Info,
  Radio,
  Tag,
  Globe,
  Hash,
  Activity,
  Save,
} from 'lucide-react';
import { api } from '../api/client';
import MonitorView from './MonitorView';
import ReaderSettingsPanel, { type OperacionSectionId } from './ReaderSettingsPanel';
import { CascadeColumn, CascadeItem } from './CascadeNav';
import { useUnsavedChanges } from '../context/UnsavedChangesContext';
import { PermAction, usePerm } from './PermAction';
import { P } from '../constants/permissions';
import { COMPANY } from '../constants/branding';

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

function StatusMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 min-w-0">
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        <span className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm font-semibold text-slate-900 break-all leading-snug">{value}</div>
    </div>
  );
}

export default function Fx9600ConnectionPanel({ showMonitor = true }: Props) {
  const { allowed: canSync } = usePerm(P.syncEjecutar);
  const canEdit = canSync;
  const [config, setConfig] = useState<Record<string, string>>({});
  const [ip, setIp] = useState('');
  const [appPort, setAppPort] = useState('8765');
  const [networkDirty, setNetworkDirty] = useState(false);
  const networkDirtyRef = useRef(false);
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [networkSaveResult, setNetworkSaveResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );
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
  const [storeCredentials, setStoreCredentials] = useState(false);
  const [hasStoredSshPassword, setHasStoredSshPassword] = useState(false);
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

  const markNetworkDirty = (dirty = true) => {
    networkDirtyRef.current = dirty;
    setNetworkDirty(dirty);
  };

  const refreshStatus = useCallback(async () => {
    if (demoMode) return;
    setStatusLoading(true);
    try {
      const st = await api.syncStatus();
      if (st.portalWebhookUrl && !networkDirtyRef.current) {
        setPortalWebhookUrl(st.portalWebhookUrl);
      }

      const health = st.health;
      const cfgIp =
        (health?.ip as string) ||
        (st.config && typeof st.config === 'object' ? String(st.config.ip ?? '') : '');
      const cfgPort =
        st.config && typeof st.config === 'object' && st.config.appPort != null
          ? String(st.config.appPort)
          : null;

      if (!networkDirtyRef.current) {
        if (cfgIp) setIp(cfgIp);
        if (cfgPort) setAppPort(cfgPort);
      }
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
  }, [demoMode]);

  useEffect(() => {
    (async () => {
      const c = await api.getConfig();
      setConfig(c);
      setIp(c.fx9600_ip ?? '');
      setAppPort(c.fx9600_app_port ?? '8765');
      markNetworkDirty(false);
      setAdminUser(c.fx9600_user ?? 'admin');
      setSshUser(c.fx9600_ssh_user ?? 'rfidadm');
      setPortalWebhookUrl(c.portal_webhook_url ?? '');
      const storedSsh = Boolean(c.fx9600_ssh_password);
      setHasStoredSshPassword(storedSsh);
      setStoreCredentials(storedSsh);
      await refreshStatus();
      try {
        const sess = await api.monitorSession();
        if (sess.active) {
          setMonitorActive(true);
          if (sess.sshUser) setSshUser(sess.sshUser);
        }
        if (sess.hasStoredSshPassword) {
          setHasStoredSshPassword(true);
          setStoreCredentials(true);
        }
      } catch {
        /* sin permiso o API no lista */
      }
    })();
    const timer = setInterval(refreshStatus, 20_000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  useEffect(() => {
    if (!showMonitor && activePanel === 'monitor') {
      guarded(() => setActivePanel('estado'));
    }
  }, [showMonitor, activePanel]);

  const parsedAppPort = () => {
    const n = Number(appPort);
    return Number.isFinite(n) && n > 0 ? n : 8765;
  };

  const handleSaveNetwork = async () => {
    const trimmedIp = ip.trim();
    if (!trimmedIp) {
      setNetworkSaveResult({ ok: false, message: 'Ingrese la IP del lector.' });
      return;
    }
    const trimmedWebhook = portalWebhookUrl.trim();
    if (!trimmedWebhook) {
      setNetworkSaveResult({
        ok: false,
        message: 'Ingrese la IP o URL de esta PC para recibir alertas del lector.',
      });
      return;
    }
    setSavingNetwork(true);
    setNetworkSaveResult(null);
    try {
      const port = parsedAppPort();
      const r = await api.syncConfig({
        ip: trimmedIp,
        appPort: port,
        portalWebhookUrl: trimmedWebhook,
      });
      setIp(trimmedIp);
      setAppPort(String(port));
      if (r.portalWebhookUrl) setPortalWebhookUrl(r.portalWebhookUrl);
      markNetworkDirty(false);
      const pushOk = r.credentialsPush?.ok !== false;
      setNetworkSaveResult({
        ok: true,
        message: pushOk
          ? `Guardado: lector ${trimmedIp}:${port} · alertas → ${r.portalWebhookUrl ?? trimmedWebhook}`
          : `Guardado en la PC, pero no se pudo actualizar el lector: ${r.credentialsPush?.error ?? 'sin respuesta'}. Use Reconectar.`,
      });
      await refreshStatus();
    } catch (e) {
      setNetworkSaveResult({
        ok: false,
        message: e instanceof Error ? e.message : 'No se pudo guardar la dirección',
      });
    } finally {
      setSavingNetwork(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    setReconnectResult(null);
    try {
      const trimmedIp = ip.trim();
      const port = parsedAppPort();
      if (trimmedIp) {
        await api.syncConfig({
          ip: trimmedIp,
          appPort: port,
          ...(portalWebhookUrl.trim() ? { portalWebhookUrl: portalWebhookUrl.trim() } : {}),
        });
        markNetworkDirty(false);
      }
      const r = await api.syncProbe({
        ...(trimmedIp ? { ip: trimmedIp, appPort: port } : {}),
      });
      if (r.ok) {
        setReconnectResult({
          ok: true,
          message: r.message ?? `Lector conectado en ${r.ip}:${r.appPort ?? port}`,
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
    if (!sshPassword.trim() && !hasStoredSshPassword) {
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
      const trimmedIp = ip.trim();
      const port = parsedAppPort();
      if (trimmedIp) {
        await api.syncConfig({
          ip: trimmedIp,
          appPort: port,
          ...(portalWebhookUrl.trim() ? { portalWebhookUrl: portalWebhookUrl.trim() } : {}),
        });
        markNetworkDirty(false);
      }

      const r = await api.monitorConnect({
        sshUser,
        ...(sshPassword.trim() ? { sshPassword } : {}),
        adminUser,
        ...(adminPassword.trim() ? { adminPassword } : {}),
        storeCredentials,
        ...(trimmedIp ? { ip: trimmedIp, appPort: port } : {}),
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
      setSshPassword('');
      setHasStoredSshPassword(Boolean(r.storedCredentials) || hasStoredSshPassword);
      if (r.storedCredentials) setStoreCredentials(true);
      else if (!storeCredentials) setHasStoredSshPassword(false);
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
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass}`}
        >
          {statusLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : appAuthenticated || reachable ? (
            <Wifi size={13} />
          ) : (
            <WifiOff size={13} />
          )}
          {statusLabel}
        </div>
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

      <p className="text-xs text-slate-500 m-0">
        Configure la IP del lector y la dirección de esta PC para recibir alertas. Luego guarde o
        reconecte.
      </p>

      {canEdit && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Radio size={14} className="text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wide">Red del lector</span>
            {networkDirty && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                Sin guardar
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-slate-600">IP del FX9600</span>
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm bg-white"
                value={ip}
                onChange={(e) => {
                  setIp(e.target.value);
                  markNetworkDirty(true);
                  setNetworkSaveResult(null);
                }}
                placeholder="169.254.240.149"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Puerto app</span>
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm bg-white"
                value={appPort}
                onChange={(e) => {
                  setAppPort(e.target.value);
                  markNetworkDirty(true);
                  setNetworkSaveResult(null);
                }}
                placeholder="8765"
                inputMode="numeric"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Globe size={12} className="text-slate-500" />
              Alertas → esta PC (IP o URL)
            </span>
            <input
              className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm bg-white"
              value={portalWebhookUrl}
              onChange={(e) => {
                setPortalWebhookUrl(e.target.value);
                markNetworkDirty(true);
                setNetworkSaveResult(null);
              }}
              placeholder="192.168.1.10 o http://192.168.1.10:3847"
              spellCheck={false}
              autoComplete="off"
            />
            <span className="text-[11px] text-slate-500 leading-snug">
              IP de esta máquina vista desde el FX9600. Puede ingresar solo la IP (se completa el puerto
              3847) o la URL completa. El lector enviará las alertas a{' '}
              <span className="font-mono">…/api/portal/alert</span>.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <PermAction
              permission={P.syncEjecutar}
              disabled={savingNetwork || !ip.trim() || !portalWebhookUrl.trim()}
              onClick={() => void handleSaveNetwork()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {savingNetwork ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </PermAction>
            <p className="text-[11px] text-slate-500 m-0">
              Tras un reset o cambio de red, actualice ambas direcciones y pulse Guardar.
            </p>
          </div>
          {networkSaveResult && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                networkSaveResult.ok
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {networkSaveResult.message}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <StatusMetric
          icon={<Radio size={14} />}
          label="En uso"
          value={ip ? `${ip}:${appPort}` : '—'}
        />
        <StatusMetric icon={<Activity size={14} />} label="User App" value={appVersion || '—'} />
        <StatusMetric icon={<Hash size={14} />} label="PID" value={appPid ?? '—'} />
        <StatusMetric
          icon={<Tag size={14} />}
          label="Lista local"
          value={
            tagCount != null
              ? `${tagCount} etiqueta${tagCount === 1 ? '' : 's'}`
              : reachable
                ? 'Requiere vincular API'
                : '—'
          }
        />
        <StatusMetric
          icon={<Globe size={14} />}
          label="Alertas → PC"
          value={portalWebhookUrl || '—'}
        />
        <StatusMetric
          icon={
            monitorActive ? (
              <CheckCircle2 size={14} className="text-emerald-600" />
            ) : (
              <WifiOff size={14} />
            )
          }
          label="Monitor en vivo"
          value={
            monitorActive ? (
              <span className="text-emerald-700">Conectado</span>
            ) : (
              <span className="text-slate-500 font-medium">No conectado</span>
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
              placeholder={
                hasStoredSshPassword
                  ? 'Guardada — completar solo para cambiarla'
                  : 'Necesaria para detener instancias huérfanas'
              }
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
        IP del lector y credenciales SSH para deploy y logs. Se actualiza la User App automáticamente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 sm:col-span-1">
          <span className="text-xs font-medium text-slate-600">IP del lector</span>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm"
            value={ip}
            onChange={(e) => {
              setIp(e.target.value);
              markNetworkDirty(true);
            }}
            placeholder="169.254.240.149"
            spellCheck={false}
            autoComplete="off"
            disabled={!canEdit}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Puerto User App</span>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm"
            value={appPort}
            onChange={(e) => {
              setAppPort(e.target.value);
              markNetworkDirty(true);
            }}
            placeholder="8765"
            inputMode="numeric"
            disabled={!canEdit}
          />
        </label>
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
            placeholder={
              hasStoredSshPassword
                ? 'Guardada — dejar vacío para reutilizarla'
                : 'Contraseña de rfidadm'
            }
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

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={storeCredentials}
          onChange={(e) => setStoreCredentials(e.target.checked)}
          disabled={!canEdit}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800">Almacenar credenciales</span>
          <span className="block text-xs text-slate-500 mt-0.5 leading-snug">
            Guarda usuario/contraseña SSH y admin en este equipo para no volver a escribirlas.
            La sesión del monitor permanece activa mientras esté conectado a RFID TRACER.
          </span>
        </span>
      </label>

      <div className="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-[13px] text-sky-950 leading-snug">
        <Info size={16} className="shrink-0 mt-0.5 text-sky-600" />
        <div className="min-w-0 space-y-1.5">
          <p className="m-0 font-semibold text-sky-900">¿Qué credenciales son estas?</p>
          <p className="m-0 text-sky-900/85">
            Corresponden al lector <strong>Zebra FX9600</strong>: el acceso SSH (por defecto usuario{' '}
            <span className="font-mono text-[12px]">rfidadm</span>) y la cuenta de administración web
            del equipo. No son las credenciales de RFID TRACER.
          </p>
          <p className="m-0 text-sky-900/85">
            Si no las recuerda, comuníquese con el área de{' '}
            <strong>soporte técnico de {COMPANY.brand}</strong> (
            <a
              href={`mailto:${COMPANY.support.email}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-800 underline underline-offset-2 hover:text-sky-950"
            >
              {COMPANY.support.email}
            </a>
            {' · '}
            <a
              href={`tel:${COMPANY.phones[0].tel}`}
              className="font-medium text-sky-800 underline underline-offset-2 hover:text-sky-950"
            >
              {COMPANY.phones[0].value}
            </a>
            ).
          </p>
        </div>
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

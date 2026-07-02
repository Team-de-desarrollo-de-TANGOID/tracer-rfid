import { useEffect, useMemo, useState } from 'react';
import { Package, Radio } from 'lucide-react';
import ConfigActivosTab from './ConfigActivosTab';
import Fx9600ConnectionPanel from './Fx9600ConnectionPanel';
import MonitorView from './MonitorView';
import type { Estado, Sku, Ubicacion } from '../types';

type MainTab = 'activos' | 'lector';
type LectorSubTab = 'conexion' | 'monitorear';

interface Props {
  estados: Estado[];
  skus: Sku[];
  ubicaciones: Ubicacion[];
  onRefresh: () => void;
  onRefreshColumnas: () => Promise<void>;
  initialLectorTab?: 'conexion' | 'monitorear' | null;
  onLectorTabConsumed?: () => void;
  permissions: {
    sku: boolean;
    estados: boolean;
    ubicaciones: boolean;
    propiedades: boolean;
    syncConfig: boolean;
    syncMonitor: boolean;
  };
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: import('react').ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: import('react').ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
        active
          ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

export default function ConfigView({
  estados,
  skus,
  ubicaciones,
  onRefresh,
  onRefreshColumnas,
  initialLectorTab,
  onLectorTabConsumed,
  permissions,
}: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  const showActivos =
    permissions.sku ||
    permissions.estados ||
    permissions.ubicaciones ||
    permissions.propiedades;
  const showLector = permissions.syncConfig || permissions.syncMonitor;

  const defaultTab = useMemo<MainTab>(() => {
    if (showActivos) return 'activos';
    if (showLector) return 'lector';
    return 'activos';
  }, [showActivos, showLector]);

  const [mainTab, setMainTab] = useState<MainTab>(defaultTab);
  const [lectorTab, setLectorTab] = useState<LectorSubTab>(
    permissions.syncConfig ? 'conexion' : 'monitorear'
  );

  useEffect(() => {
    if (!initialLectorTab) return;
    setMainTab('lector');
    setLectorTab(initialLectorTab);
    onLectorTabConsumed?.();
  }, [initialLectorTab, onLectorTabConsumed]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-[#e2e8f0] shrink-0">
        <h1 className="text-2xl font-bold text-[#0f172a] m-0">Configuración</h1>
        <p className="text-[13px] text-[#64748b] mt-1 m-0">
          Catálogos del sistema y lector de puerta Zebra FX9600.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {showActivos && (
            <TabButton active={mainTab === 'activos'} onClick={() => setMainTab('activos')}>
              <span className="inline-flex items-center gap-1.5">
                <Package size={16} />
                Activos
              </span>
            </TabButton>
          )}
          {showLector && (
            <TabButton active={mainTab === 'lector'} onClick={() => setMainTab('lector')}>
              <span className="inline-flex items-center gap-1.5">
                <Radio size={16} />
                Lector Zebra FX9600
              </span>
            </TabButton>
          )}
        </div>

        {mainTab === 'lector' && showLector && (
          <div className="flex gap-1 mt-3 p-1 bg-slate-100 rounded-lg w-fit">
            {permissions.syncConfig && (
              <SubTabButton
                active={lectorTab === 'conexion'}
                onClick={() => setLectorTab('conexion')}
              >
                Conexión
              </SubTabButton>
            )}
            {permissions.syncMonitor && (
              <SubTabButton
                active={lectorTab === 'monitorear'}
                onClick={() => setLectorTab('monitorear')}
              >
                Monitorear
              </SubTabButton>
            )}
          </div>
        )}
      </header>

      {msg && (
        <div className="mx-8 mt-4 px-4 py-2 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-200 shrink-0">
          {msg}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {mainTab === 'activos' && showActivos && (
          <div className="p-8 overflow-y-auto flex-1">
            <ConfigActivosTab
              estados={estados}
              skus={skus}
              ubicaciones={ubicaciones}
              onRefresh={onRefresh}
              onRefreshColumnas={onRefreshColumnas}
              permissions={{
                sku: permissions.sku,
                estados: permissions.estados,
                ubicaciones: permissions.ubicaciones,
                propiedades: permissions.propiedades,
              }}
              onFlash={flash}
            />
          </div>
        )}

        {mainTab === 'lector' && showLector && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {lectorTab === 'conexion' && permissions.syncConfig && (
              <div className="p-8 overflow-y-auto flex-1">
                <Fx9600ConnectionPanel canEdit={permissions.syncConfig} />
              </div>
            )}
            {lectorTab === 'monitorear' && permissions.syncMonitor && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <MonitorView embedded />
              </div>
            )}
          </div>
        )}

        {!showActivos && !showLector && (
          <p className="p-8 text-sm text-slate-500">No tiene permisos de configuración.</p>
        )}
      </div>
    </div>
  );
}

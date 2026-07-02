import { useMemo, useState } from 'react';
import ConfigActivosTab from './ConfigActivosTab';
import Fx9600ConnectionPanel from './Fx9600ConnectionPanel';
import UsersRolesView from './UsersRolesView';
import type { ConfigSection, Estado, Sku, Ubicacion } from '../types';

const SECTION_META: Record<ConfigSection, { title: string; description: string }> = {
  catalogos: {
    title: 'Propiedades de activos',
    description: 'SKUs, estados, ubicaciones y campos personalizables del inventario.',
  },
  'lector-puerta': {
    title: 'Lector de puerta',
    description: 'Configuración de red, acceso al lector y monitoreo en tiempo real.',
  },
  'usuarios-roles': {
    title: 'Usuarios y roles',
    description: 'Gestioná quién accede al sistema y qué puede hacer cada rol.',
  },
};

interface Props {
  section: ConfigSection;
  estados: Estado[];
  skus: Sku[];
  ubicaciones: Ubicacion[];
  onRefresh: () => void;
  onRefreshColumnas: () => Promise<void>;
  permissions: {
    sku: boolean;
    estados: boolean;
    ubicaciones: boolean;
    propiedades: boolean;
    syncConfig: boolean;
    syncMonitor: boolean;
    manageUsers: boolean;
    manageRoles: boolean;
    viewUsers: boolean;
  };
}

export default function ConfigView({
  section,
  estados,
  skus,
  ubicaciones,
  onRefresh,
  onRefreshColumnas,
  permissions,
}: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  const meta = SECTION_META[section];

  const canShowSection = useMemo(() => {
    switch (section) {
      case 'catalogos':
        return (
          permissions.sku ||
          permissions.estados ||
          permissions.ubicaciones ||
          permissions.propiedades
        );
      case 'lector-puerta':
        return permissions.syncConfig || permissions.syncMonitor;
      case 'usuarios-roles':
        return permissions.viewUsers || permissions.manageUsers || permissions.manageRoles;
      default:
        return false;
    }
  }, [section, permissions]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-[#e2e8f0] shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 m-0">
          Configuración
        </p>
        <h1 className="text-2xl font-bold text-[#0f172a] m-0 mt-1">{meta.title}</h1>
        <p className="text-[13px] text-[#64748b] mt-1 m-0">{meta.description}</p>
      </header>

      {msg && section !== 'usuarios-roles' && (
        <div className="mx-8 mt-4 px-4 py-2 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-200 shrink-0">
          {msg}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {!canShowSection ? (
          <p className="p-8 text-sm text-slate-500">No tiene permisos para esta sección.</p>
        ) : section === 'catalogos' ? (
          <div className="flex-1 min-h-0 overflow-hidden p-8">
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
        ) : section === 'lector-puerta' ? (
          <div className="p-8 flex-1 min-h-0 overflow-hidden">
            <Fx9600ConnectionPanel
              canEdit={permissions.syncConfig}
              showMonitor={permissions.syncMonitor}
            />
          </div>
        ) : (
          <UsersRolesView
            embedded
            canManageUsers={permissions.manageUsers}
            canManageRoles={permissions.manageRoles}
            canViewUsers={permissions.viewUsers}
          />
        )}
      </div>
    </div>
  );
}

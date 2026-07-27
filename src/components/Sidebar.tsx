import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  Plus,
  CloudUpload,
  Settings,
  Info,
  Users,
  LogOut,
  Package,
  Radio,
  ChevronDown,
  LayoutDashboard,
  CircleHelp,
} from 'lucide-react';
import AppIcon from './AppIcon';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../constants/branding';
import { api } from '../api/client';
import { CONFIG_SECTIONS, ACTIVOS_SECTIONS, type ActivosSection, type ConfigSection, type SidebarTab, type User } from '../types';
import { APP_PATHS, parseAppPath, pathForTab } from '../routes/appRoutes';

interface SidebarProps {
  canAccessActivosSection: (section: ActivosSection) => boolean;
  canAccessConfigSection: (section: ConfigSection) => boolean;
  totalCount: number;
  activeCount: number;
  user: User;
  onLogout: () => void;
  canAccessTab: (tab: SidebarTab) => boolean;
  canCheckReader?: boolean;
}

const NAV: { id: SidebarTab; label: string; icon: typeof Database }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'activos', label: 'Activos', icon: Package },
  { id: 'sincronizar', label: 'Sincronizar puerta', icon: CloudUpload },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
  { id: 'ayuda', label: 'Ayuda', icon: CircleHelp },
];

const ACTIVOS_ICONS: Record<ActivosSection, typeof Database> = {
  inventario: Database,
  agregar: Plus,
};

const CONFIG_ICONS: Record<ConfigSection, typeof Package> = {
  catalogos: Package,
  'lector-puerta': Radio,
  'usuarios-roles': Users,
};

const SUBNAV_TRANSITION = {
  duration: 0.55,
  ease: [0.4, 0, 0.2, 1] as const,
};

function SidebarSubnav({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={SUBNAV_TRANSITION}
          className="overflow-hidden"
        >
          <motion.div
            initial={{ y: -6 }}
            animate={{ y: 0 }}
            exit={{ y: -6 }}
            transition={SUBNAV_TRANSITION}
            className="ml-3 pl-3 border-l border-slate-200 space-y-0.5 py-0.5"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Sidebar({
  canAccessActivosSection,
  canAccessConfigSection,
  totalCount,
  activeCount,
  user,
  onLogout,
  canAccessTab,
  canCheckReader = false,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { tab: currentTab, activosSection, configSection } = parseAppPath(location.pathname);
  const [hovered, setHovered] = useState(false);
  const [activosOpen, setActivosOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const expanded = hovered;

  const [readerConnected, setReaderConnected] = useState<boolean | null>(null);

  const visibleConfigSections = CONFIG_SECTIONS.filter((s) => canAccessConfigSection(s.id));
  const visibleActivosSections = ACTIVOS_SECTIONS.filter((s) => canAccessActivosSection(s.id));
  const isConfigActive = currentTab === 'configuracion';
  const isActivosActive = currentTab === 'activos';
  const activeActivosSection = activosSection ?? 'inventario';
  const activeConfigSection = configSection ?? 'catalogos';
  const showActivosSubnav =
    expanded && visibleActivosSections.length > 0 && activosOpen;
  const showConfigSubnav =
    expanded && visibleConfigSections.length > 0 && configOpen;

  useEffect(() => {
    if (isActivosActive) setActivosOpen(true);
  }, [isActivosActive]);

  useEffect(() => {
    if (isConfigActive) setConfigOpen(true);
  }, [isConfigActive]);

  useEffect(() => {
    if (!canCheckReader) {
      setReaderConnected(null);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const st = await api.syncStatus();
        if (!cancelled) {
          setReaderConnected(Boolean(st.connected));
        }
      } catch {
        if (!cancelled) setReaderConnected(false);
      }
    };

    check();
    const timer = setInterval(check, 45_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [canCheckReader]);

  const inactiveCount = totalCount - activeCount;
  const visibleNav = NAV.filter((item) => canAccessTab(item.id));

  const openConfig = (section: ConfigSection) => {
    setConfigOpen(true);
    setActivosOpen(false);
    if (canAccessConfigSection(section)) navigate(APP_PATHS.config(section));
  };

  const openActivos = (section: ActivosSection) => {
    setActivosOpen(true);
    setConfigOpen(false);
    if (canAccessActivosSection(section)) {
      navigate(section === 'agregar' ? APP_PATHS.activosAgregar : APP_PATHS.activosInventario);
    }
  };

  const toggleActivos = () => {
    setHovered(true);
    setConfigOpen(false);
    setActivosOpen((open) => !open);
  };

  const toggleConfig = () => {
    setHovered(true);
    setActivosOpen(false);
    setConfigOpen((open) => !open);
  };

  return (
    <aside className="w-[72px] flex-shrink-0 relative z-40">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          if (!isActivosActive) setActivosOpen(false);
          if (!isConfigActive) setConfigOpen(false);
        }}
        className={`absolute inset-y-0 left-0 bg-[#f8fafc] text-slate-700 flex flex-col overflow-hidden border-r border-slate-200 transition-[width,box-shadow] duration-500 ease-in-out ${
          expanded ? 'w-[260px] shadow-xl shadow-slate-300/50' : 'w-[72px]'
        }`}
      >
        <div className="h-[72px] shrink-0 border-b border-slate-200 flex items-center px-3 overflow-hidden bg-white">
          <div
            className={`flex items-center min-w-0 w-full transition-[gap] duration-500 ease-in-out ${
              expanded ? 'gap-3' : 'justify-center gap-0'
            }`}
          >
            <AppIcon size={36} className="shrink-0" />
            <div
              className={`min-w-0 overflow-hidden transition-[opacity,max-width] duration-500 ease-in-out ${
                expanded ? 'opacity-100 max-w-[188px]' : 'opacity-0 max-w-0'
              }`}
              aria-hidden={!expanded}
            >
              <div className="h-9 flex flex-col justify-center overflow-hidden">
                <div className="text-[14px] font-bold tracking-wide leading-tight whitespace-nowrap truncate text-slate-900">
                  {APP_NAME}
                </div>
                <div className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-2">
                  {APP_TAGLINE}
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav
          className={`flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden ${
            expanded ? 'px-3' : 'px-2'
          }`}
        >
          {visibleNav.map(({ id, label, icon: Icon }) => {
            if (id === 'activos') {
              return (
                <div key={id} className="space-y-0.5">
                  <button
                    type="button"
                    title={expanded ? undefined : label}
                    onClick={toggleActivos}
                    className={`w-full flex items-center rounded-lg transition-all cursor-pointer relative ${
                      expanded ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
                    } ${
                      isActivosActive
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : activosOpen
                          ? 'bg-slate-200/80 text-slate-800'
                          : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    <div className={`flex items-center ${expanded ? 'gap-3 text-[13px]' : ''}`}>
                      <Icon size={18} className="flex-shrink-0" />
                      {expanded && <span className="whitespace-nowrap">{label}</span>}
                    </div>
                    {expanded && visibleActivosSections.length > 0 && (
                      <ChevronDown
                        size={14}
                        className={`flex-shrink-0 transition-transform duration-500 ease-in-out ${
                          showActivosSubnav ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    )}
                    {!expanded && totalCount > 0 && (
                      <span
                        className={`absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-mono font-bold flex items-center justify-center ${
                          isActivosActive ? 'bg-blue-800 text-white' : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {totalCount > 99 ? '99+' : totalCount}
                      </span>
                    )}
                    {expanded && totalCount > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0 ${
                          isActivosActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {totalCount}
                      </span>
                    )}
                  </button>

                  <SidebarSubnav show={showActivosSubnav}>
                    {visibleActivosSections.map(({ id: sectionId, label: sectionLabel }) => {
                      const SubIcon = ACTIVOS_ICONS[sectionId];
                      const active = isActivosActive && activeActivosSection === sectionId;
                      return (
                        <button
                          key={sectionId}
                          type="button"
                          onClick={() => openActivos(sectionId)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-all cursor-pointer ${
                            active
                              ? 'bg-blue-100 text-blue-800 font-medium'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          <SubIcon size={14} className="flex-shrink-0" />
                          <span className="whitespace-nowrap truncate">{sectionLabel}</span>
                        </button>
                      );
                    })}
                  </SidebarSubnav>
                </div>
              );
            }

            if (id === 'configuracion') {
              return (
                <div key={id} className="space-y-0.5">
                  <button
                    type="button"
                    title={expanded ? undefined : label}
                    onClick={toggleConfig}
                    className={`w-full flex items-center rounded-lg transition-all cursor-pointer relative ${
                      expanded ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
                    } ${
                      isConfigActive
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : configOpen
                          ? 'bg-slate-200/80 text-slate-800'
                          : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    <div className={`flex items-center ${expanded ? 'gap-3 text-[13px]' : ''}`}>
                      <Icon size={18} className="flex-shrink-0" />
                      {expanded && <span className="whitespace-nowrap">{label}</span>}
                    </div>
                    {expanded && visibleConfigSections.length > 0 && (
                      <ChevronDown
                        size={14}
                        className={`flex-shrink-0 transition-transform duration-500 ease-in-out ${
                          showConfigSubnav ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    )}
                  </button>

                  <SidebarSubnav show={showConfigSubnav}>
                    {visibleConfigSections.map(({ id: sectionId, label: sectionLabel }) => {
                      const SubIcon = CONFIG_ICONS[sectionId];
                      const active = isConfigActive && activeConfigSection === sectionId;
                      return (
                        <button
                          key={sectionId}
                          type="button"
                          onClick={() => openConfig(sectionId)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-all cursor-pointer ${
                            active
                              ? 'bg-blue-100 text-blue-800 font-medium'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          <SubIcon size={14} className="flex-shrink-0" />
                          <span className="whitespace-nowrap truncate">{sectionLabel}</span>
                        </button>
                      );
                    })}
                  </SidebarSubnav>
                </div>
              );
            }

            return (
              <button
                key={id}
                type="button"
                title={expanded ? undefined : label}
                onClick={() => {
                  setActivosOpen(false);
                  setConfigOpen(false);
                  navigate(pathForTab(id));
                }}
                className={`w-full flex items-center rounded-lg transition-all cursor-pointer relative ${
                  expanded ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
                } ${
                  currentTab === id
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <div className={`flex items-center ${expanded ? 'gap-3 text-[13px]' : ''}`}>
                  <Icon size={18} className="flex-shrink-0" />
                  {expanded && <span className="whitespace-nowrap">{label}</span>}
                </div>
              </button>
            );
          })}
        </nav>

        {expanded && (
          <div className="p-4 mx-3 mb-3 bg-white border border-slate-200 rounded-lg space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wider min-w-0">
                <Info size={13} className="text-blue-600 flex-shrink-0" />
                <span>Resumen</span>
              </div>
              {canCheckReader && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-medium normal-case tracking-normal flex-shrink-0"
                  title={
                    readerConnected === null
                      ? 'Consultando lector…'
                      : readerConnected
                        ? 'Lector de puerta conectado'
                        : 'Lector de puerta sin respuesta'
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      readerConnected === null
                        ? 'bg-amber-400 animate-pulse'
                        : readerConnected
                          ? 'bg-emerald-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <span
                    className={
                      readerConnected === null
                        ? 'text-amber-700'
                        : readerConnected
                          ? 'text-emerald-700'
                          : 'text-red-600'
                    }
                  >
                    {readerConnected === null ? '…' : readerConnected ? 'Puerta' : 'Sin conexión'}
                  </span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-50 p-1.5 rounded-md border border-slate-100">
                <div className="text-[10px] text-slate-500">Activas</div>
                <div className="text-xs font-mono font-bold text-emerald-600">{activeCount}</div>
              </div>
              <div className="bg-slate-50 p-1.5 rounded-md border border-slate-100">
                <div className="text-[10px] text-slate-500">Otras</div>
                <div className="text-xs font-mono font-bold text-slate-600">{inactiveCount}</div>
              </div>
            </div>
          </div>
        )}

        <div
          className={`border-t border-slate-200 bg-white ${
            expanded ? 'p-4 space-y-2' : 'p-2 space-y-2'
          }`}
        >
          {expanded ? (
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-800 m-0 truncate">{user.nombre}</p>
              <p className="text-[10px] text-slate-500 m-0 truncate">{user.rolNombre}</p>
            </div>
          ) : (
            <div
              className="w-9 h-9 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700"
              title={`${user.nombre} — ${user.rolNombre}`}
            >
              {user.nombre.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Cerrar sesión"
            className={`w-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors ${
              expanded ? 'gap-2 py-2 text-xs' : 'py-2'
            }`}
          >
            <LogOut size={16} />
            {expanded && <span>Cerrar sesión</span>}
          </button>
          {expanded && (
            <p className="text-[10px] text-slate-400 font-mono text-center m-0">v{APP_VERSION}</p>
          )}
        </div>
      </div>
    </aside>
  );
}

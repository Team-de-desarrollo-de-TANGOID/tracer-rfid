import { useEffect, useState } from 'react';
import {
  Database,
  Plus,
  ScanLine,
  CloudUpload,
  Settings,
  Info,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Logo from './Logo';
import { APP_NAME, APP_TAGLINE } from '../constants/branding';
import { api } from '../api/client';
import type { SidebarTab, User } from '../types';

const STORAGE_KEY = 'rc_sidebar_collapsed';

interface SidebarProps {
  currentTab: SidebarTab;
  setCurrentTab: (tab: SidebarTab) => void;
  totalCount: number;
  activeCount: number;
  user: User;
  onLogout: () => void;
  canAccessTab: (tab: SidebarTab) => boolean;
  demoMode?: boolean;
  canCheckReader?: boolean;
}

const NAV: { id: SidebarTab; label: string; icon: typeof Database }[] = [
  { id: 'inventario', label: 'Inventario', icon: Database },
  { id: 'agregar', label: 'Alta de activo', icon: Plus },
  { id: 'auditoria', label: 'Auditoría rápida', icon: ScanLine },
  { id: 'sincronizar', label: 'Sincronizar puerta', icon: CloudUpload },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
  { id: 'usuarios', label: 'Usuarios y roles', icon: Users },
];

export default function Sidebar({
  currentTab,
  setCurrentTab,
  totalCount,
  activeCount,
  user,
  onLogout,
  canAccessTab,
  demoMode = false,
  canCheckReader = false,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const [readerConnected, setReaderConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!canCheckReader || demoMode) {
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
  }, [canCheckReader, demoMode]);

  const inactiveCount = totalCount - activeCount;
  const visibleNav = NAV.filter((item) => canAccessTab(item.id));

  return (
    <aside
      className={`bg-slate-800 text-white flex flex-col flex-shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Header */}
      <div
        className={`border-b border-white/10 flex items-center ${
          collapsed ? 'flex-col gap-2 py-4 px-2' : 'justify-between p-5'
        }`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
          <Logo size={36} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[14px] font-bold tracking-wide leading-tight whitespace-nowrap">
                {APP_NAME}
              </div>
              <div className="text-[9px] text-slate-400 font-medium leading-snug">
                {APP_TAGLINE}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          className={`flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors flex-shrink-0 ${
            collapsed ? 'w-8 h-8' : 'w-7 h-7'
          }`}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'}`}>
        {visibleNav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={collapsed ? label : undefined}
            onClick={() => setCurrentTab(id)}
            className={`w-full flex items-center rounded-md transition-all cursor-pointer relative ${
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
            } ${
              currentTab === id
                ? 'bg-blue-500 text-white font-medium shadow-sm'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`flex items-center ${collapsed ? '' : 'gap-3 text-[13px]'}`}>
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </div>
            {id === 'inventario' && totalCount > 0 && (
              collapsed ? (
                <span
                  className={`absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-mono font-bold flex items-center justify-center ${
                    currentTab === id ? 'bg-blue-700 text-white' : 'bg-slate-600 text-slate-200'
                  }`}
                >
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              ) : (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0 ${
                    currentTab === id ? 'bg-blue-600' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {totalCount}
                </span>
              )
            )}
          </button>
        ))}
      </nav>

      {/* Resumen — solo expandido */}
      {!collapsed && (
        <div className="p-4 mx-3 mb-3 bg-slate-900/40 border border-white/5 rounded-lg space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold uppercase tracking-wider min-w-0">
              <Info size={13} className="text-blue-400 flex-shrink-0" />
              <span>Resumen</span>
            </div>
            {canCheckReader && !demoMode && (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-medium normal-case tracking-normal flex-shrink-0"
                title={
                  readerConnected === null
                    ? 'Consultando lector…'
                    : readerConnected
                      ? 'User App API conectada'
                      : 'User App API sin respuesta'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    readerConnected === null
                      ? 'bg-amber-400 animate-pulse'
                      : readerConnected
                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.75)]'
                        : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                  }`}
                />
                <span
                  className={
                    readerConnected === null
                      ? 'text-amber-300/90'
                      : readerConnected
                        ? 'text-emerald-300'
                        : 'text-red-300'
                  }
                >
                  {readerConnected === null ? '…' : readerConnected ? 'User App' : 'Offline'}
                </span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-900/60 p-1.5 rounded border border-white/5">
              <div className="text-[10px] text-slate-400">Activas</div>
              <div className="text-xs font-mono font-bold text-emerald-400">{activeCount}</div>
            </div>
            <div className="bg-slate-900/60 p-1.5 rounded border border-white/5">
              <div className="text-[10px] text-slate-400">Otras</div>
              <div className="text-xs font-mono font-bold text-slate-300">{inactiveCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className={`border-t border-white/10 bg-slate-900/30 ${
          collapsed ? 'p-2 space-y-2' : 'p-4 space-y-2'
        }`}
      >
        {!collapsed ? (
          <div className="text-center">
            <p className="text-xs font-semibold text-white m-0 truncate">{user.nombre}</p>
            <p className="text-[10px] text-slate-400 m-0 truncate">{user.rolNombre}</p>
          </div>
        ) : (
          <div
            className="w-9 h-9 mx-auto rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200"
            title={`${user.nombre} — ${user.rolNombre}`}
          >
            {user.nombre.charAt(0).toUpperCase()}
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          title="Cerrar sesión"
          className={`w-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer transition-colors ${
            collapsed ? 'py-2' : 'gap-2 py-2 text-xs'
          }`}
        >
          <LogOut size={16} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
        {!collapsed && (
          <p className="text-[10px] text-slate-500 font-mono text-center m-0">v0.2.0</p>
        )}
      </div>
    </aside>
  );
}

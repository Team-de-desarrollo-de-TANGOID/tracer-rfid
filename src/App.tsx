import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginView from './components/LoginView';
import InventoryView from './components/InventoryView';
import AddAssetView from './components/AddAssetView';
import DashboardView from './components/DashboardView';
import PortalAlertPopup from './components/PortalAlertPopup';
import SyncView from './components/SyncView';
import ConfigView from './components/ConfigView';
import HelpView from './components/HelpView';
import ElectronTitleBar from './components/ElectronTitleBar';
import StatusBar from './components/StatusBar';
import type {
  Activo,
  ActivosSection,
  ConfigSection,
  Estado,
  InventarioColumnasConfig,
  Sku,
  SidebarTab,
  Ubicacion,
} from './types';
import { ACTIVOS_SECTIONS, CONFIG_SECTIONS, PERMISSION_TAB_MAP } from './types';
import { P } from './constants/permissions';
import {
  APP_PATHS,
  getDefaultAppPath,
  isConfigSection,
  isPathAllowed,
} from './routes/appRoutes';

function AppChrome({
  children,
  showStatusBar = false,
}: {
  children: ReactNode;
  showStatusBar?: boolean;
}) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
      <ElectronTitleBar />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
      {showStatusBar ? <StatusBar /> : null}
    </div>
  );
}
function AnimatedPage({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function ConfigPage({
  estados,
  skus,
  ubicaciones,
  onRefresh,
  onRefreshColumnas,
  permissions,
}: {
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
}) {
  const { configSection: param } = useParams<{ configSection: string }>();
  const section: ConfigSection = isConfigSection(param) ? param : 'catalogos';

  return (
    <ConfigView
      section={section}
      estados={estados}
      skus={skus}
      ubicaciones={ubicaciones}
      onRefresh={onRefresh}
      onRefreshColumnas={onRefreshColumnas}
      permissions={permissions}
    />
  );
}

export default function App() {
  const { user, loading: authLoading, login, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activos, setActivos] = useState<Activo[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [columnasConfig, setColumnasConfig] = useState<InventarioColumnasConfig | null>(null);
  const [stats, setStats] = useState({ total: 0, activas: 0, inactivas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const focusActivoId = Number.parseInt(searchParams.get('activo') ?? '', 10) || null;

  const canAccessTab = useCallback(
    (t: SidebarTab) => {
      if (t === 'ayuda') return true;
      const perms = PERMISSION_TAB_MAP[t];
      return perms.some((p) => hasPermission(p));
    },
    [hasPermission]
  );

  const canAccessConfigSection = useCallback(
    (section: ConfigSection) => {
      const def = CONFIG_SECTIONS.find((s) => s.id === section);
      return def ? def.permissions.some((p) => hasPermission(p)) : false;
    },
    [hasPermission]
  );

  const canAccessActivosSection = useCallback(
    (section: ActivosSection) => {
      const def = ACTIVOS_SECTIONS.find((s) => s.id === section);
      return def ? def.permissions.some((p) => hasPermission(p)) : false;
    },
    [hasPermission]
  );

  const defaultPath = useMemo(
    () => getDefaultAppPath(canAccessTab, canAccessActivosSection, canAccessConfigSection),
    [canAccessTab, canAccessActivosSection, canAccessConfigSection]
  );

  const goToInventario = useCallback(() => {
    navigate(APP_PATHS.activosInventario);
  }, [navigate]);

  const clearInventarioFocus = useCallback(() => {
    if (!searchParams.has('activo')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('activo');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const canLoadInventario = hasPermission(P.inventarioVer);
      const promises: Promise<unknown>[] = [
        canLoadInventario ? api.getActivos() : Promise.resolve([]),
        api.getEstados(),
        hasPermission(P.activosCrear, P.configSku) ? api.getSkus() : Promise.resolve([]),
        api.getUbicacionesAll().catch(() => api.getUbicaciones()),
        hasPermission(P.inventarioVer)
          ? api.getStats()
          : Promise.resolve({ total: 0, activas: 0, inactivas: 0 }),
        canLoadInventario || hasPermission(P.inventarioColumnas)
          ? api.getInventarioColumnas()
          : Promise.resolve(null),
      ];

      const [a, e, s, u, st, cols] = await Promise.all(promises);
      setActivos(a as Activo[]);
      setEstados(e as Estado[]);
      setSkus(s as Sku[]);
      setUbicaciones(u as Ubicacion[]);
      setStats(st as { total: number; activas: number; inactivas: number });
      setColumnasConfig(cols as InventarioColumnasConfig | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión con la API local.');
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission]);

  const refreshColumnas = useCallback(async () => {
    if (!user) return;
    if (!hasPermission(P.inventarioVer) && !hasPermission(P.inventarioColumnas)) return;
    try {
      const cols = await api.getInventarioColumnas();
      setColumnasConfig(cols);
    } catch {
      /* ignore */
    }
  }, [user, hasPermission]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    if (
      !isPathAllowed(
        location.pathname,
        canAccessTab,
        canAccessActivosSection,
        canAccessConfigSection
      )
    ) {
      navigate(defaultPath, { replace: true });
    }
  }, [
    user,
    location.pathname,
    defaultPath,
    navigate,
    canAccessTab,
    canAccessActivosSection,
    canAccessConfigSection,
  ]);

  const configPermissions = useMemo(
    () => ({
      sku: hasPermission(P.configSku),
      estados: hasPermission(P.configEstados),
      ubicaciones: hasPermission(P.configUbicaciones),
      propiedades: hasPermission(P.configPropiedades),
      syncConfig: hasPermission(P.syncEjecutar),
      syncMonitor:
        hasPermission(P.syncVerHistorial) ||
        hasPermission(P.syncEjecutar) ||
        hasPermission(P.syncControlApp),
      manageUsers: hasPermission(P.usuariosGestionar),
      manageRoles: hasPermission(P.rolesGestionar),
      viewUsers: hasPermission(P.usuariosVer),
    }),
    [hasPermission]
  );

  if (authLoading) {
    return (
      <AppChrome>
        <div className="flex-1 flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
          Cargando…
        </div>
      </AppChrome>
    );
  }

  if (!user) {
    return (
      <AppChrome>
        <LoginView onLogin={login} />
      </AppChrome>
    );
  }

  return (
    <AppChrome showStatusBar>
    <div className="flex h-full bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar
        totalCount={stats.total}
        activeCount={stats.activas}
        user={user}
        onLogout={logout}
        canAccessTab={canAccessTab}
        canAccessActivosSection={canAccessActivosSection}
        canAccessConfigSection={canAccessConfigSection}
        canCheckReader={
          hasPermission(P.syncVerHistorial) ||
          hasPermission(P.syncEjecutar) ||
          hasPermission(P.syncControlApp)
        }
      />

      <PortalAlertPopup
        enabled={hasPermission(P.dashboardAlertas, P.dashboardVer)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {error && (
          <div className="mx-4 mt-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error} — Verifique que el servidor local esté en ejecución.
          </div>
        )}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Cargando datos…
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  canAccessTab('dashboard') ? (
                    <AnimatedPage>
                      <DashboardView />
                    </AnimatedPage>
                  ) : (
                    <Navigate to={defaultPath} replace />
                  )
                }
              />
              <Route
                path="/dashboard"
                element={<Navigate to="/" replace />}
              />
              <Route
                path="/activos/inventario"
                element={
                  canAccessActivosSection('inventario') ? (
                    <AnimatedPage>
                      <InventoryView
                        activos={activos}
                        estados={estados}
                        ubicaciones={ubicaciones}
                        columnasConfig={columnasConfig}
                        focusActivoId={focusActivoId}
                        onFocusHandled={clearInventarioFocus}
                        onRefresh={refresh}
                        onUpdateEstado={async (id, estadoId, motivoBaja) => {
                          await api.updateActivoEstado(id, estadoId, motivoBaja);
                          await refresh();
                        }}
                        onBatchUpdateEstado={async (ids, estadoId, motivoBaja) => {
                          await api.updateActivosEstadoLote(ids, estadoId, motivoBaja);
                          await refresh();
                        }}
                        onBatchUpdateUbicacion={async (ids, ubicacionId) => {
                          await api.updateActivosUbicacionLote(ids, ubicacionId);
                          await refresh();
                        }}
                        onBatchDelete={async (ids) => {
                          const result = await api.deleteActivosLote(ids);
                          await refresh();
                          return result;
                        }}
                        onUpdateActivo={async (id, body) => {
                          await api.updateActivo(id, body);
                          await refresh();
                        }}
                        onSaveColumnas={async (columnas) => {
                          const cfg = await api.saveInventarioColumnas(columnas);
                          setColumnasConfig(cfg);
                        }}
                      />
                    </AnimatedPage>
                  ) : (
                    <Navigate to={defaultPath} replace />
                  )
                }
              />
              <Route
                path="/activos/agregar"
                element={
                  canAccessActivosSection('agregar') ? (
                    <AnimatedPage>
                      <AddAssetView
                        skus={skus}
                        estados={estados}
                        ubicaciones={ubicaciones}
                        columnasConfig={columnasConfig}
                        onCreated={refresh}
                        onGoToInventario={goToInventario}
                      />
                    </AnimatedPage>
                  ) : (
                    <Navigate to={defaultPath} replace />
                  )
                }
              />
              <Route
                path="/sincronizar"
                element={
                  canAccessTab('sincronizar') ? (
                    <AnimatedPage>
                      <SyncView
                        onSynced={refresh}
                        onOpenConfig={
                          canAccessTab('configuracion')
                            ? () => navigate(APP_PATHS.config('lector-puerta'))
                            : undefined
                        }
                      />
                    </AnimatedPage>
                  ) : (
                    <Navigate to={defaultPath} replace />
                  )
                }
              />
              <Route
                path="/configuracion/:configSection"
                element={
                  canAccessTab('configuracion') ? (
                    <AnimatedPage>
                      <ConfigPage
                        estados={estados}
                        skus={skus}
                        ubicaciones={ubicaciones}
                        onRefresh={refresh}
                        onRefreshColumnas={refreshColumnas}
                        permissions={configPermissions}
                      />
                    </AnimatedPage>
                  ) : (
                    <Navigate to={defaultPath} replace />
                  )
                }
              />
              <Route
                path="/ayuda"
                element={
                  <AnimatedPage>
                    <HelpView />
                  </AnimatedPage>
                }
              />
              <Route path="*" element={<Navigate to={defaultPath} replace />} />
            </Routes>
          </AnimatePresence>
        )}
      </main>
    </div>
    </AppChrome>
  );
}

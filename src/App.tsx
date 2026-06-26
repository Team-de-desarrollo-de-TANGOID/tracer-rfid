import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginView from './components/LoginView';
import InventoryView from './components/InventoryView';
import AddAssetView from './components/AddAssetView';
import AuditView from './components/AuditView';
import SyncView from './components/SyncView';
import ConfigView from './components/ConfigView';
import UsersRolesView from './components/UsersRolesView';
import DemoBanner from './components/DemoBanner';
import type { Activo, Estado, InventarioColumnasConfig, Sku, SidebarTab, Ubicacion } from './types';
import { PERMISSION_TAB_MAP } from './types';

export default function App() {
  const { user, loading: authLoading, login, logout, hasPermission } = useAuth();
  const [tab, setTab] = useState<SidebarTab>('inventario');
  const [activos, setActivos] = useState<Activo[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [columnasConfig, setColumnasConfig] = useState<InventarioColumnasConfig | null>(null);
  const [stats, setStats] = useState({ total: 0, activas: 0, inactivas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventarioFocusActivoId, setInventarioFocusActivoId] = useState<number | null>(null);

  const canAccessTab = useCallback(
    (t: SidebarTab) => {
      const perms = PERMISSION_TAB_MAP[t];
      return perms.some((p) => hasPermission(p));
    },
    [hasPermission]
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const canLoadInventario = hasPermission('inventario.ver') || hasPermission('auditoria.ejecutar');
      const promises: Promise<unknown>[] = [
        canLoadInventario ? api.getActivos() : Promise.resolve([]),
        api.getEstados(),
        hasPermission('activos.crear', 'config.sku') ? api.getSkus() : Promise.resolve([]),
        api.getUbicacionesAll().catch(() => api.getUbicaciones()),
        hasPermission('inventario.ver')
          ? api.getStats()
          : Promise.resolve({ total: 0, activas: 0, inactivas: 0 }),
        canLoadInventario || hasPermission('inventario.columnas')
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
    if (!hasPermission('inventario.ver') && !hasPermission('inventario.columnas')) return;
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
    if (!canAccessTab(tab)) {
      const first = (Object.keys(PERMISSION_TAB_MAP) as SidebarTab[]).find(canAccessTab);
      if (first) setTab(first);
    }
  }, [user, tab, canAccessTab]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
        Cargando…
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={login} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar
        currentTab={tab}
        setCurrentTab={setTab}
        totalCount={stats.total}
        activeCount={stats.activas}
        user={user}
        onLogout={logout}
        canAccessTab={canAccessTab}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <DemoBanner />
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
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {tab === 'inventario' && canAccessTab('inventario') && (
                <InventoryView
                  activos={activos}
                  estados={estados}
                  ubicaciones={ubicaciones}
                  columnasConfig={columnasConfig}
                  focusActivoId={inventarioFocusActivoId}
                  onFocusHandled={() => setInventarioFocusActivoId(null)}
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
                    await api.deleteActivosLote(ids);
                    await refresh();
                  }}
                  onUpdateActivo={async (id, body) => {
                    await api.updateActivo(id, body);
                    await refresh();
                  }}
                  onSaveColumnas={async (columnas) => {
                    const cfg = await api.saveInventarioColumnas(columnas);
                    setColumnasConfig(cfg);
                  }}
                  canEdit={hasPermission('activos.editar')}
                  canChangeEstado={hasPermission('activos.cambiar_estado')}
                  canDelete={hasPermission('activos.eliminar')}
                  canConfigColumnas={hasPermission('inventario.columnas')}
                  canVerHistorial={hasPermission('activos.ver_historial')}
                  canQuickEdit={hasPermission('activos.edicion_rapida')}
                />
              )}
              {tab === 'agregar' && canAccessTab('agregar') && (
                <AddAssetView
                  skus={skus}
                  estados={estados}
                  ubicaciones={ubicaciones}
                  columnasConfig={columnasConfig}
                  onCreated={refresh}
                  setCurrentTab={setTab}
                />
              )}
              {tab === 'auditoria' && canAccessTab('auditoria') && (
                <AuditView
                  activos={activos}
                  columnasConfig={columnasConfig}
                  onSaveColumnas={async (columnas) => {
                    const cfg = await api.saveInventarioColumnas(columnas);
                    setColumnasConfig(cfg);
                  }}
                  canConfigColumnas={hasPermission('inventario.columnas')}
                  canGoToInventario={hasPermission('inventario.ver')}
                  canGuardarAuditoria={hasPermission('auditoria.ejecutar')}
                  canVerHistorial={
                    hasPermission('auditoria.ver_historial') || hasPermission('auditoria.ejecutar')
                  }
                  onGoToRecord={(activo) => {
                    setInventarioFocusActivoId(activo.id);
                    setTab('inventario');
                  }}
                />
              )}
              {tab === 'sincronizar' && canAccessTab('sincronizar') && (
                <SyncView onSynced={refresh} canSync={hasPermission('sync.ejecutar')} />
              )}
              {tab === 'configuracion' && canAccessTab('configuracion') && (
                <ConfigView
                  estados={estados}
                  skus={skus}
                  ubicaciones={ubicaciones}
                  onRefresh={refresh}
                  onRefreshColumnas={refreshColumnas}
                  permissions={{
                    sku: hasPermission('config.sku'),
                    estados: hasPermission('config.estados'),
                    ubicaciones: hasPermission('config.ubicaciones'),
                    propiedades: hasPermission('config.propiedades'),
                  }}
                />
              )}
              {tab === 'usuarios' && canAccessTab('usuarios') && (
                <UsersRolesView
                  canManageUsers={hasPermission('usuarios.gestionar')}
                  canManageRoles={hasPermission('roles.gestionar')}
                  canViewUsers={hasPermission('usuarios.ver')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

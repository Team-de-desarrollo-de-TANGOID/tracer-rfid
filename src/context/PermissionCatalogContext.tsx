import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getStoredToken } from '../api/client';
import type { Permiso } from '../types';

interface PermissionCatalogContextValue {
  catalog: Permiso[];
  loading: boolean;
  getPermissionName: (codigo: string) => string;
  refreshCatalog: () => Promise<void>;
}

const PermissionCatalogContext = createContext<PermissionCatalogContextValue | null>(null);

export function PermissionCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCatalog = useCallback(async () => {
    if (!getStoredToken()) {
      setCatalog([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await api.getPermisosCatalog();
      setCatalog(rows);
    } catch {
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  const getPermissionName = useCallback(
    (codigo: string) => {
      const row = catalog.find((p) => p.codigo === codigo);
      return row?.nombre ?? codigo;
    },
    [catalog]
  );

  const value = useMemo(
    () => ({ catalog, loading, getPermissionName, refreshCatalog }),
    [catalog, loading, getPermissionName, refreshCatalog]
  );

  return (
    <PermissionCatalogContext.Provider value={value}>{children}</PermissionCatalogContext.Provider>
  );
}

export function usePermissionCatalog() {
  const ctx = useContext(PermissionCatalogContext);
  if (!ctx) {
    throw new Error('usePermissionCatalog debe usarse dentro de PermissionCatalogProvider');
  }
  return ctx;
}

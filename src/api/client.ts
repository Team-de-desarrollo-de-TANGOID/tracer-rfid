const BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'rc_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

import type {
  Activo,
  AuditTag,
  AuditoriaCompleta,
  AuditoriaResumen,
  ColumnaTabla,
  Estado,
  EventoActivo,
  FxMonitorSnapshot,
  InventarioColumnasConfig,
  Permiso,
  Rol,
  Sku,
  Ubicacion,
  User,
  UsuarioListItem,
} from '../types';

export const api = {
  health: () => request<{ ok: boolean; demo: boolean; version: string }>('/api/health'),

  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => request<{ user: User }>('/api/auth/me'),

  getActivos: (params?: { q?: string; estadoId?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.estadoId) qs.set('estadoId', String(params.estadoId));
    const q = qs.toString();
    return request<Activo[]>(`/api/activos${q ? `?${q}` : ''}`);
  },

  getStats: () =>
    request<{ total: number; activas: number; inactivas: number }>('/api/activos/stats'),

  getHistorial: (activoId: number) =>
    request<EventoActivo[]>(`/api/activos/${activoId}/historial`),

  createActivo: (body: {
    epc: string;
    skuId: number;
    estadoId: number;
    ubicacionId?: number;
    ubicacion?: string;
    descripcion?: string;
    codigoInterno?: string;
    propiedadesExtra?: Record<string, string>;
  }) => request<Activo>('/api/activos', { method: 'POST', body: JSON.stringify(body) }),

  createActivosLote: (body: {
    epcs: string[];
    skuId: number;
    estadoId: number;
    ubicacionId?: number;
    descripcion?: string;
    codigoInterno?: string;
    propiedadesExtra?: Record<string, string>;
  }) =>
    request<{ total: number; creados: string[]; errores: { epc: string; error: string }[]; mensaje: string }>(
      '/api/activos/lote',
      { method: 'POST', body: JSON.stringify(body) }
    ),

  updateActivo: (
    id: number,
    body: Partial<{
      descripcion: string;
      ubicacionId: number;
      ubicacion: string;
      codigoInterno: string;
      motivoBaja: string;
      propiedadesExtra: Record<string, string>;
    }>
  ) => request<Activo>(`/api/activos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  updateActivoEstado: (id: number, estadoId: number, motivoBaja?: string) =>
    request<Activo>(`/api/activos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estadoId, motivoBaja }),
    }),

  updateActivosEstadoLote: (ids: number[], estadoId: number, motivoBaja?: string) =>
    request<{ total: number; errores: { id: number; error: string }[]; mensaje: string }>(
      '/api/activos/estado/lote',
      { method: 'PATCH', body: JSON.stringify({ ids, estadoId, motivoBaja }) }
    ),

  updateActivosUbicacionLote: (ids: number[], ubicacionId: number) =>
    request<{ total: number; errores: { id: number; error: string }[]; mensaje: string }>(
      '/api/activos/ubicacion/lote',
      { method: 'PATCH', body: JSON.stringify({ ids, ubicacionId }) }
    ),

  deleteActivosLote: (ids: number[]) =>
    request<{ total: number; errores: { id: number; error: string }[]; mensaje: string }>(
      '/api/activos/lote',
      { method: 'DELETE', body: JSON.stringify({ ids }) }
    ),

  deleteActivo: (id: number) =>
    request<{ ok: boolean }>(`/api/activos/${id}`, { method: 'DELETE' }),

  getSkus: () => request<Sku[]>('/api/skus'),
  getSkusAll: () => request<Sku[]>('/api/skus/all'),
  createSku: (codigo: string, descripcion: string) =>
    request<Sku>('/api/skus', { method: 'POST', body: JSON.stringify({ codigo, descripcion }) }),
  updateSku: (id: number, body: Partial<{ descripcion: string; activo: boolean }>) =>
    request<Sku>(`/api/skus/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  getEstados: () => request<Estado[]>('/api/estados'),
  createEstado: (body: {
    nombre: string;
    color?: string;
    esActivo?: boolean;
    tipoOperativo?: 'habilitado' | 'deshabilitado';
    habilitado?: boolean;
    permiteSalida?: boolean;
    codigo?: string;
  }) => request<Estado>('/api/estados', { method: 'POST', body: JSON.stringify(body) }),
  updateEstado: (
    id: number,
    body: Partial<{
      nombre: string;
      color: string;
      esActivo: boolean;
      tipoOperativo: 'habilitado' | 'deshabilitado';
      habilitado: boolean;
      permiteSalida: boolean;
      orden: number;
      codigo: string;
    }>
  ) => request<Estado>(`/api/estados/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEstado: (id: number) =>
    request<{ ok: boolean }>(`/api/estados/${id}`, { method: 'DELETE' }),

  getUbicaciones: () => request<Ubicacion[]>('/api/ubicaciones'),
  getUbicacionesAll: () => request<Ubicacion[]>('/api/ubicaciones/all'),
  createUbicacion: (nombre: string, tipo?: string, descripcion?: string) =>
    request<Ubicacion>('/api/ubicaciones', {
      method: 'POST',
      body: JSON.stringify({ nombre, tipo, descripcion }),
    }),
  updateUbicacion: (
    id: number,
    body: Partial<{ nombre: string; tipo: string; descripcion: string; activo: boolean; orden: number }>
  ) =>
    request<Ubicacion>(`/api/ubicaciones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteUbicacion: (id: number) =>
    request<{ ok: boolean }>(`/api/ubicaciones/${id}`, { method: 'DELETE' }),

  getInventarioColumnas: () =>
    request<InventarioColumnasConfig>('/api/preferencias/inventario-columnas'),
  saveInventarioColumnas: (columnas: string[]) =>
    request<InventarioColumnasConfig>('/api/preferencias/inventario-columnas', {
      method: 'PUT',
      body: JSON.stringify({ columnas }),
    }),

  getPropiedadesActivo: () => request<ColumnaTabla[]>('/api/propiedades-activo'),
  getPropiedadesAlta: () => request<ColumnaTabla[]>('/api/activos/propiedades-alta'),
  createPropiedadActivo: (body: {
    etiqueta: string;
    tipo?: string;
    editable?: boolean;
    visibleDefault?: boolean;
  }) =>
    request<ColumnaTabla>('/api/propiedades-activo', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updatePropiedadActivo: (
    id: number,
    body: Partial<{
      etiqueta: string;
      editable: boolean;
      visibleDefault: boolean;
      orden: number;
      oculta: boolean;
      tipo: string;
    }>
  ) =>
    request<ColumnaTabla>(`/api/propiedades-activo/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deletePropiedadActivo: (id: number) =>
    request<{ ok: boolean }>(`/api/propiedades-activo/${id}`, { method: 'DELETE' }),

  getUsuarios: () => request<UsuarioListItem[]>('/api/usuarios'),
  createUsuario: (body: {
    username: string;
    password: string;
    nombre?: string;
    rolId: number;
  }) => request<UsuarioListItem>('/api/usuarios', { method: 'POST', body: JSON.stringify(body) }),
  updateUsuario: (
    id: number,
    body: Partial<{ nombre: string; rolId: number; activo: boolean; password: string }>
  ) =>
    request<UsuarioListItem>(`/api/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteUsuario: (id: number) =>
    request<{ ok: boolean }>(`/api/usuarios/${id}`, { method: 'DELETE' }),

  getRoles: () => request<Rol[]>('/api/roles'),
  getPermisos: () => request<Permiso[]>('/api/roles/permisos'),
  createRol: (body: { nombre: string; descripcion?: string; permisos: string[] }) =>
    request<Rol>('/api/roles', { method: 'POST', body: JSON.stringify(body) }),
  updateRol: (
    id: number,
    body: Partial<{ nombre: string; descripcion: string; permisos: string[] }>
  ) => request<Rol>(`/api/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRol: (id: number) => request<{ ok: boolean }>(`/api/roles/${id}`, { method: 'DELETE' }),

  mockScanOne: () =>
    request<{ tid: string; demo: boolean }>('/api/mock/scan-one', { method: 'POST' }),
  mockScanBatch: (count?: number) =>
    request<{ epcs: string[]; total: number; demo: boolean }>('/api/mock/scan-batch', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),
  mockAuditScanOne: () =>
    request<{ tid: string; demo: boolean }>('/api/mock/audit/scan-one', { method: 'POST' }),

  saveAuditoria: (body: { tids: string[]; fechaInicio?: string; notas?: string }) =>
    request<{
      id: number;
      total: number;
      registrados: number;
      desconocidos: number;
      tags: AuditTag[];
    }>('/api/auditorias', { method: 'POST', body: JSON.stringify(body) }),

  getAuditorias: (limit = 100) =>
    request<AuditoriaResumen[]>(`/api/auditorias?limit=${limit}`),

  getAuditoria: (id: number) => request<AuditoriaCompleta>(`/api/auditorias/${id}`),

  mockAuditComplete: (tids: string[]) =>
    request<{
      id: number;
      tags: AuditTag[];
      total: number;
      registrados: number;
      desconocidos: number;
      demo: boolean;
    }>('/api/mock/audit/complete', { method: 'POST', body: JSON.stringify({ tids }) }),

  mockAudit: (count?: number) =>
    request<{
      id: number;
      tags: AuditTag[];
      total: number;
      registrados: number;
      desconocidos: number;
      demo: boolean;
    }>('/api/mock/audit', { method: 'POST', body: JSON.stringify({ count }) }),

  sync: () =>
    request<{
      total: number;
      mensaje: string;
      modo: string;
      version: number;
      warning?: boolean;
      inventoryWarning?: string;
    }>('/api/sync', { method: 'POST' }),
  syncHistory: () =>
    request<{ id: number; fecha: string; total_enviados: number; mensaje: string }[]>(
      '/api/sync/history'
    ),
  syncStatus: () =>
    request<{
      demo: boolean;
      connected: boolean;
      appOk?: boolean;
      appError?: string;
      appStatus?: { count?: number; version?: number; pid?: number };
      error?: string;
      config?: Record<string, string | number>;
    }>('/api/sync/status'),
  syncProbe: (body?: { ip?: string; appPort?: number; user?: string; password?: string }) =>
    request<{
      ok: boolean;
      ip: string;
      appPort?: number;
      message?: string;
      error?: string;
    }>('/api/sync/probe', { method: 'POST', body: JSON.stringify(body ?? {}) }),
  syncConfig: (body: {
    ip?: string;
    user?: string;
    password?: string;
    appName?: string;
    gpoPin?: number;
    appPort?: number;
  }) =>
    request<{
      ok: boolean;
      config: Record<string, string | number>;
      credentialsPush?: { ok: boolean; error?: string };
    }>('/api/sync/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  syncTestGpo: (pin?: number) =>
    request<{ ok: boolean; pin: number; message: string }>('/api/sync/test-gpo', {
      method: 'POST',
      body: JSON.stringify(pin != null ? { pin } : {}),
    }),
  syncAllowList: () =>
    request<{
      demo?: boolean;
      reader: { version: number; tids: string[]; count: number; updatedAt?: number | null };
      dbTids: string[];
      onlyInDb: string[];
      onlyInReader: string[];
      inSync: boolean;
    }>('/api/sync/allowlist'),
  syncMonitorSnapshot: (offset = 0) =>
    request<FxMonitorSnapshot>(`/api/sync/monitor/snapshot?offset=${offset}`),
  subscribeSyncMonitor: (opts: {
    offset?: number;
    interval?: number;
    signal?: AbortSignal;
    onSnapshot: (snap: FxMonitorSnapshot) => void;
    onError?: (message: string) => void;
    onClose?: () => void;
  }) => {
    const token = getStoredToken();
    const qs = new URLSearchParams();
    if (opts.offset) qs.set('offset', String(opts.offset));
    if (opts.interval) qs.set('interval', String(opts.interval));
    const path = `/api/sync/monitor/stream${qs.toString() ? `?${qs}` : ''}`;

    (async () => {
      try {
        const res = await fetch(`${BASE}${path}`, {
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: opts.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? res.statusText);
        }
        if (!res.body) throw new Error('Stream no disponible');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (!part.trim()) continue;
            let event = 'message';
            let data = '';
            for (const line of part.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              else if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (!data) continue;
            try {
              const parsed = JSON.parse(data) as FxMonitorSnapshot & { message?: string };
              if (event === 'error') opts.onError?.(parsed.message ?? data);
              else opts.onSnapshot(parsed);
            } catch {
              opts.onError?.(data);
            }
          }
        }
      } catch (e) {
        if (opts.signal?.aborted) return;
        opts.onError?.(e instanceof Error ? e.message : 'Error de conexión al monitor');
      } finally {
        if (!opts.signal?.aborted) opts.onClose?.();
      }
    })();
  },
  getConfig: () => request<Record<string, string>>('/api/config'),
};

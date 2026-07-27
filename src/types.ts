import { P } from './constants/permissions';

export interface Estado {
  id: number;
  codigo?: string;
  nombre: string;
  color: string;
  es_activo: number;
  esActivo?: boolean;
  tipoOperativo?: 'habilitado' | 'deshabilitado';
  habilitado?: boolean;
  permite_salida?: number;
  permiteSalida?: boolean;
  orden: number;
  es_sistema?: number;
  esSistema?: boolean;
}

export interface Sku {
  id: number;
  codigo: string;
  descripcion: string;
  activo: number;
}

export interface Ubicacion {
  id: number;
  nombre: string;
  tipo: string;
  descripcion: string;
  activo: boolean;
  orden: number;
}

export interface Activo {
  id: number;
  tid: string;
  epc?: string;
  sku: string;
  skuId: number;
  estado: string;
  estadoId: number;
  estadoColor: string;
  esActivo: boolean;
  permiteSalida?: boolean;
  fecha: string;
  fechaBaja?: string | null;
  motivoBaja?: string;
  ubicacion?: string;
  ubicacionId?: number | null;
  descripcion?: string;
  codigoInterno?: string;
  propiedadesExtra?: Record<string, string>;
}

export type TipoPropiedad = 'texto' | 'numero' | 'fecha' | 'lista';

export interface ColumnaTabla {
  id: number;
  codigo: string;
  etiqueta: string;
  orden: number;
  visibleDefault: boolean;
  editable: boolean;
  esSistema?: boolean;
  oculta?: boolean;
  tipo?: TipoPropiedad;
  campoActivo?: string | null;
  esCustom?: boolean;
  enUso?: boolean;
  vecesUtilizada?: number;
  creadoPor?: string;
  obligatoriaAlta?: boolean;
  listaOpciones?: string[];
  listaMultiple?: boolean;
}

export interface InventarioColumnasConfig {
  columnas: ColumnaTabla[];
  visibles: string[];
  columnasActivas: ColumnaTabla[];
}

export interface User {
  id: number;
  username: string;
  nombre: string;
  activo: boolean;
  rolId: number;
  rolNombre: string;
  rolEsSistema: boolean;
  permisos: string[];
  /** Inicio de la sesión actual. */
  ultimoLogin?: string | null;
  /** Inicio de sesión anterior (si hubo). */
  loginAnterior?: string | null;
}

export interface UsuarioListItem {
  id: number;
  username: string;
  nombre: string;
  activo: boolean;
  rolId: number;
  rolNombre: string;
  createdAt: string;
  /** Usuario Administrador del sistema: no se desactiva ni elimina. */
  esSistema?: boolean;
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string;
  esSistema: boolean;
  permisos: string[];
  usuariosCount: number;
  createdAt: string;
}

export interface Permiso {
  id: number;
  codigo: string;
  nombre: string;
  modulo: string;
}

export interface EventoActivo {
  id: number;
  activoId: number | null;
  epc: string;
  tipo: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  ubicacionAnterior: string | null;
  ubicacionNueva: string | null;
  usuarioNombre: string | null;
  origen: string;
  metadata: Record<string, unknown>;
  notas: string;
  createdAt: string;
}

export type SidebarTab =
  | 'dashboard'
  | 'activos'
  | 'sincronizar'
  | 'configuracion'
  | 'ayuda';

export type ActivosSection = 'inventario' | 'agregar';

export const ACTIVOS_SECTIONS: {
  id: ActivosSection;
  label: string;
  permissions: string[];
}[] = [
  {
    id: 'inventario',
    label: 'Inventario',
    permissions: [P.inventarioVer],
  },
  {
    id: 'agregar',
    label: 'Agregar activos',
    permissions: [P.activosCrear],
  },
];

export type ConfigSection = 'catalogos' | 'lector-puerta' | 'usuarios-roles';

export const CONFIG_SECTIONS: {
  id: ConfigSection;
  label: string;
  permissions: string[];
}[] = [
  {
    id: 'catalogos',
    label: 'Propiedades de activos',
    permissions: [P.configSku, P.configEstados, P.configUbicaciones, P.configPropiedades],
  },
  {
    id: 'lector-puerta',
    label: 'Lector de puerta',
    permissions: [P.syncEjecutar, P.syncVerHistorial, P.syncControlApp],
  },
  {
    id: 'usuarios-roles',
    label: 'Usuarios y roles',
    permissions: [P.usuariosVer, P.usuariosGestionar, P.rolesGestionar],
  },
];

export interface FxMonitorSnapshot {
  demo?: boolean;
  ts: string;
  message?: string;
  config?: { ip?: string; appName?: string; gpoPin?: number };
  logs?: { lines?: string; size?: number; restOk?: boolean; error?: string };
  process?: {
    running?: boolean;
    pid?: string | null;
    restOk?: boolean;
    app?: string;
    appVersion?: string;
    error?: string;
  };
  allowList?: {
    version?: number;
    count?: number;
    gpoPin?: number | null;
    updatedAt?: number | null;
    restOk?: boolean;
    error?: string;
  };
  reader?: { ok?: boolean; ip?: string; status?: unknown; error?: string };
  logOffset?: number;
  tagEvents?: {
    since?: number;
    latest?: number;
    events?: FxTagReadEvent[];
    restOk?: boolean;
    error?: string;
  };
  tagEventSince?: number;
}

export interface FxTagReadEvent {
  id: number;
  ts: string;
  tag: string;
  authorized: boolean;
  meta?: string;
  gpo?: number;
}

export type DashboardPeriod = 'hoy' | 'ayer' | 'semana' | 'mes' | 'mes_anterior' | 'personalizado';

export interface DashboardRange {
  period: string;
  label: string;
  from: string;
  to: string;
}

export interface DashboardEstadoCount {
  id: number;
  nombre: string;
  color: string | null;
  esActivo: boolean;
  cantidad: number;
}

export interface PortalDeteccionResumen {
  id: number;
  tid: string;
  detectadoAt: string;
  antena: number | null;
  rssi: number | null;
  sku: string | null;
  estado: string | null;
  estadoColor: string | null;
}

export interface PortalDeteccion extends PortalDeteccionResumen {
  activoId: number | null;
  tipo: string;
  eventoLectorId: number | null;
  createdAt: string;
  ubicacion: string | null;
}

export interface DashboardData {
  range: DashboardRange;
  activos: {
    total: number;
    activas: number;
    inactivas: number;
    porEstado: DashboardEstadoCount[];
  };
  portal: {
    salidasDenegadas: number;
    salidasPeriodoAnterior: number;
    periodoAnteriorLabel: string;
    noRegistradas: number;
    porDia: { fecha: string; cantidad: number }[];
    ultimaDeteccionAt: string | null;
    ultimasDetecciones: PortalDeteccionResumen[];
  };
  generatedAt: string;
}

export interface PortalAlertPayload {
  kind: 'denied' | 'denied_batch';
  count?: number;
  totalEnPeriodo?: number | null;
  deteccion: PortalDeteccion;
  detecciones?: PortalDeteccion[];
}

export const PERMISSION_TAB_MAP: Record<SidebarTab, string[]> = {
  dashboard: [P.dashboardVer],
  activos: [P.inventarioVer, P.activosCrear],
  sincronizar: [P.syncEjecutar, P.syncVerHistorial, P.syncControlApp],
  configuracion: [
    P.configSku,
    P.configEstados,
    P.configUbicaciones,
    P.configPropiedades,
    P.inventarioColumnas,
    P.syncEjecutar,
    P.syncVerHistorial,
    P.syncControlApp,
    P.usuariosVer,
    P.usuariosGestionar,
    P.rolesGestionar,
  ],
  /** Acceso libre para cualquier usuario autenticado. */
  ayuda: [],
};

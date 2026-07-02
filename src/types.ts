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
}

export interface UsuarioListItem {
  id: number;
  username: string;
  nombre: string;
  activo: boolean;
  rolId: number;
  rolNombre: string;
  createdAt: string;
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
  | 'activos'
  | 'auditoria'
  | 'sincronizar'
  | 'configuracion';

export type ActivosSection = 'inventario' | 'agregar';

export const ACTIVOS_SECTIONS: {
  id: ActivosSection;
  label: string;
  permissions: string[];
}[] = [
  {
    id: 'inventario',
    label: 'Inventario',
    permissions: ['inventario.ver'],
  },
  {
    id: 'agregar',
    label: 'Agregar activos',
    permissions: ['activos.crear'],
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
    permissions: ['config.sku', 'config.estados', 'config.ubicaciones', 'config.propiedades'],
  },
  {
    id: 'lector-puerta',
    label: 'Lector de puerta',
    permissions: ['sync.ejecutar', 'sync.ver_historial'],
  },
  {
    id: 'usuarios-roles',
    label: 'Usuarios y roles',
    permissions: ['usuarios.ver', 'usuarios.gestionar', 'roles.gestionar'],
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

export interface AuditTag {
  epc: string;
  tid?: string;
  registrado: boolean;
}

export interface AuditoriaResumen {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  totalLeidos: number;
  totalRegistrados: number;
  totalDesconocidos: number;
  usuarioId: number | null;
  usuarioNombre: string | null;
  usuarioUsername: string | null;
  notas: string;
}

export interface AuditoriaDetalleItem {
  id: number;
  tid: string;
  epc: string;
  registrado: boolean;
  activoId: number | null;
  sku: string | null;
  estado: string | null;
  estadoColor: string | null;
  ubicacion: string | null;
}

export interface AuditoriaCompleta extends AuditoriaResumen {
  detalle: AuditoriaDetalleItem[];
}

export const PERMISSION_TAB_MAP: Record<SidebarTab, string[]> = {
  activos: ['inventario.ver', 'activos.crear'],
  auditoria: ['auditoria.ejecutar', 'auditoria.ver_historial'],
  sincronizar: ['sync.ejecutar', 'sync.ver_historial'],
  configuracion: [
    'config.sku',
    'config.estados',
    'config.ubicaciones',
    'config.propiedades',
    'inventario.columnas',
    'sync.ejecutar',
    'sync.ver_historial',
    'usuarios.ver',
    'usuarios.gestionar',
    'roles.gestionar',
  ],
};

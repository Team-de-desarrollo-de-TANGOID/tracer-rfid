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

export type TipoPropiedad = 'texto' | 'numero' | 'fecha';

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
  | 'inventario'
  | 'agregar'
  | 'auditoria'
  | 'sincronizar'
  | 'configuracion'
  | 'usuarios';

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
  inventario: ['inventario.ver'],
  agregar: ['activos.crear'],
  auditoria: ['auditoria.ejecutar', 'auditoria.ver_historial'],
  sincronizar: ['sync.ejecutar', 'sync.ver_historial'],
  configuracion: ['config.sku', 'config.estados', 'config.ubicaciones', 'config.propiedades', 'inventario.columnas'],
  usuarios: ['usuarios.ver', 'usuarios.gestionar', 'roles.gestionar'],
};

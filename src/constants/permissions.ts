/** Códigos de permiso — mantener alineado con server/constants/permissions.js */
export const P = {
  inventarioVer: 'inventario.ver',
  inventarioColumnas: 'inventario.columnas',
  activosCrear: 'activos.crear',
  activosEditar: 'activos.editar',
  activosCambiarEstado: 'activos.cambiar_estado',
  activosEliminar: 'activos.eliminar',
  activosVerHistorial: 'activos.ver_historial',
  activosEdicionRapida: 'activos.edicion_rapida',
  dashboardVer: 'dashboard.ver',
  dashboardAlertas: 'dashboard.alertas',
  dashboardReiniciarContador: 'dashboard.reiniciar_contador',
  syncEjecutar: 'sync.ejecutar',
  syncVerHistorial: 'sync.ver_historial',
  syncControlApp: 'sync.control_app',
  configSku: 'config.sku',
  configEstados: 'config.estados',
  configUbicaciones: 'config.ubicaciones',
  configPropiedades: 'config.propiedades',
  usuariosVer: 'usuarios.ver',
  usuariosGestionar: 'usuarios.gestionar',
  rolesGestionar: 'roles.gestionar',
} as const;

export type PermissionCode = (typeof P)[keyof typeof P];

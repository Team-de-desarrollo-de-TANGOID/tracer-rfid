/** Permisos predefinidos del sistema — no editables por el cliente. */
export const PERMISSIONS = [
  { codigo: 'inventario.ver', nombre: 'Ver inventario', modulo: 'inventario' },
  { codigo: 'inventario.columnas', nombre: 'Configurar columnas del inventario', modulo: 'inventario' },
  { codigo: 'activos.crear', nombre: 'Dar de alta activos', modulo: 'activos' },
  { codigo: 'activos.editar', nombre: 'Editar activos', modulo: 'activos' },
  { codigo: 'activos.cambiar_estado', nombre: 'Cambiar estado de activos', modulo: 'activos' },
  { codigo: 'activos.eliminar', nombre: 'Eliminar activos', modulo: 'activos' },
  { codigo: 'activos.ver_historial', nombre: 'Ver historial de activos', modulo: 'activos' },
  { codigo: 'activos.edicion_rapida', nombre: 'Edición rápida en tabla', modulo: 'activos' },
  { codigo: 'dashboard.ver', nombre: 'Ver dashboard del portal', modulo: 'dashboard' },
  { codigo: 'dashboard.alertas', nombre: 'Recibir alertas de salida no autorizada', modulo: 'dashboard' },
  { codigo: 'dashboard.reiniciar_contador', nombre: 'Reiniciar contador de toallas detectadas', modulo: 'dashboard' },
  { codigo: 'sync.ejecutar', nombre: 'Sincronizar lista con lector de puerta', modulo: 'sync' },
  { codigo: 'sync.ver_historial', nombre: 'Ver historial de sincronización', modulo: 'sync' },
  { codigo: 'sync.control_app', nombre: 'Iniciar y detener User App en el lector', modulo: 'sync' },
  { codigo: 'config.sku', nombre: 'Gestionar catálogo SKU', modulo: 'configuracion' },
  { codigo: 'config.estados', nombre: 'Gestionar estados de activos', modulo: 'configuracion' },
  { codigo: 'config.ubicaciones', nombre: 'Gestionar ubicaciones', modulo: 'configuracion' },
  { codigo: 'config.propiedades', nombre: 'Gestionar propiedades de activos', modulo: 'configuracion' },
  { codigo: 'usuarios.ver', nombre: 'Ver usuarios', modulo: 'usuarios' },
  { codigo: 'usuarios.gestionar', nombre: 'Crear, editar y desactivar usuarios', modulo: 'usuarios' },
  { codigo: 'roles.gestionar', nombre: 'Gestionar roles y permisos', modulo: 'usuarios' },
];

/** Columnas disponibles para la tabla de inventario — predefinidas. */
export const INVENTORY_COLUMNS = [
  { codigo: 'tid', etiqueta: 'TID (RFID)', orden: 1, visible_default: 1, editable: 0 },
  { codigo: 'sku', etiqueta: 'SKU', orden: 2, visible_default: 1, editable: 0 },
  { codigo: 'estado', etiqueta: 'Estado', orden: 3, visible_default: 1, editable: 1 },
  { codigo: 'ubicacion', etiqueta: 'Ubicación', orden: 4, visible_default: 1, editable: 1 },
  { codigo: 'descripcion', etiqueta: 'Descripción', orden: 5, visible_default: 0, editable: 1 },
  { codigo: 'codigo_interno', etiqueta: 'Código interno', orden: 6, visible_default: 0, editable: 1 },
  { codigo: 'fecha_registro', etiqueta: 'Fecha registro', orden: 7, visible_default: 1, editable: 0 },
  { codigo: 'fecha_baja', etiqueta: 'Fecha baja', orden: 8, visible_default: 0, editable: 0 },
  { codigo: 'motivo_baja', etiqueta: 'Motivo baja', orden: 9, visible_default: 0, editable: 1 },
];

export const ADMIN_ROLE_NAME = 'Administrador';
export const ADMIN_USERNAME = 'admin';
export const ADMIN_DEFAULT_PASSWORD = 'Admin3915';

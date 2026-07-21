import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Columns3,
  X,
  Filter,
  ListFilter,
  CheckSquare,
  Square,
  MinusSquare,
  Loader2,
  Eye,
  Pencil,
  Check,
  MapPin,
  Trash2,
  Ban,
  CircleDot,
} from 'lucide-react';
import ActivoDetalleModal from './ActivoDetalleModal';
import ActivoTableCell, { getEditableVisibleColumns } from './ActivoTableCell';
import ColumnPickerModal from './ColumnPickerModal';
import { useActivoInlineEdit } from '../hooks/useActivoInlineEdit';
import { estadoRequiereMotivoBaja } from '../utils/activoEdit';
import { estadoEstaDeshabilitado, estadoEstaHabilitado } from '../utils/estadoOperativo';
import SortableColumnHeader, { useColumnSortState } from './SortableColumnHeader';
import { findColumna, sortActivos } from '../utils/tableSort';
import { DEFAULT_INVENTORY_COLUMNS, toggleColumnVisibility, clampVisibleColumns } from '../constants/inventoryColumns';
import InventoryFiltersPanel from './InventoryFiltersPanel';
import { getActivoPropiedadValor } from '../utils/activoProps';
import {
  EMPTY_SYSTEM_FILTERS,
  countActiveFilters,
  getCustomFilterProperties,
  matchesInventoryFilters,
  type CustomFilter,
  type SystemFilters,
} from '../utils/inventoryFilters';
import type { Activo, ColumnaTabla, Estado, InventarioColumnasConfig, Ubicacion } from '../types';
import { PermAction, usePerm } from './PermAction';
import { P } from '../constants/permissions';

interface Props {
  activos: Activo[];
  estados: Estado[];
  ubicaciones: Ubicacion[];
  columnasConfig: InventarioColumnasConfig | null;
  onRefresh: () => void;
  onUpdateEstado: (id: number, estadoId: number, motivoBaja?: string) => Promise<void>;
  onBatchUpdateEstado: (ids: number[], estadoId: number, motivoBaja?: string) => Promise<void>;
  onBatchUpdateUbicacion: (ids: number[], ubicacionId: number) => Promise<void>;
  onBatchDelete: (ids: number[]) => Promise<{ total: number; errores: { id: number; error: string }[]; mensaje: string }>;
  onUpdateActivo: (
    id: number,
    body: Partial<{ descripcion: string; ubicacionId: number; codigoInterno: string; motivoBaja: string }>
  ) => Promise<void>;
  onSaveColumnas: (columnas: string[]) => Promise<void>;
  focusActivoId?: number | null;
  onFocusHandled?: () => void;
}

type BatchModalType = 'estado' | 'ubicacion' | 'remover';
type RemoverModo = 'baja' | 'eliminar';

export default function InventoryView({
  activos,
  estados,
  ubicaciones,
  columnasConfig,
  onUpdateEstado,
  onBatchUpdateEstado,
  onBatchUpdateUbicacion,
  onBatchDelete,
  onUpdateActivo,
  onSaveColumnas,
  focusActivoId = null,
  onFocusHandled,
}: Props) {
  const { allowed: canEdit } = usePerm(P.activosEditar);
  const { allowed: canChangeEstado } = usePerm(P.activosCambiarEstado);
  const { allowed: canDelete } = usePerm(P.activosEliminar);
  const { allowed: canVerHistorial } = usePerm(P.activosVerHistorial);
  const { allowed: canQuickEdit } = usePerm(P.activosEdicionRapida);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const [systemFilters, setSystemFilters] = useState<SystemFilters>(EMPTY_SYSTEM_FILTERS);
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [copiedTid, setCopiedTid] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [draftColumnas, setDraftColumnas] = useState<string[]>([]);
  const [detalleActivo, setDetalleActivo] = useState<Activo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchModal, setBatchModal] = useState<BatchModalType | null>(null);
  const [batchEstadoId, setBatchEstadoId] = useState(0);
  const [batchUbicacionId, setBatchUbicacionId] = useState(0);
  const [batchMotivo, setBatchMotivo] = useState('');
  const [removerModo, setRemoverModo] = useState<RemoverModo>('baja');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  const columnasActivas = columnasConfig?.columnasActivas ?? DEFAULT_INVENTORY_COLUMNS;
  const editableVisibleCols = useMemo(
    () => getEditableVisibleColumns(columnasActivas),
    [columnasActivas]
  );
  const quickEditEnabled = canQuickEdit && editableVisibleCols.length > 0 && (canEdit || canChangeEstado);
  const { sortColumn, sortDir, toggleSort } = useColumnSortState();

  const inlineEdit = useActivoInlineEdit({
    estados,
    ubicaciones,
    canEdit,
    canChangeEstado,
    canQuickEdit: quickEditEnabled,
    onUpdateActivo,
    onUpdateEstado,
  });

  useEffect(() => {
    if (!detalleActivo) return;
    const fresh = activos.find((a) => a.id === detalleActivo.id);
    if (fresh) setDetalleActivo(fresh);
  }, [activos, detalleActivo?.id]);

  useEffect(() => {
    if (focusActivoId == null) return;
    const activo = activos.find((a) => a.id === focusActivoId);
    if (!activo) {
      onFocusHandled?.();
      return;
    }
    setSearchTerm('');
    setSystemFilters(EMPTY_SYSTEM_FILTERS);
    setCustomFilters([]);
    setShowFilters(false);
    setPendingFocusId(focusActivoId);
  }, [focusActivoId, activos, onFocusHandled]);

  const columnasCatalogo = columnasConfig?.columnas ?? DEFAULT_INVENTORY_COLUMNS;
  const customFilterProperties = useMemo(
    () => getCustomFilterProperties(columnasCatalogo),
    [columnasCatalogo]
  );

  const activeFilterCount = useMemo(
    () => countActiveFilters(systemFilters, customFilters),
    [systemFilters, customFilters]
  );

  const estadoCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of estados) counts.set(e.id, 0);
    for (const a of activos) {
      if (counts.has(a.estadoId)) {
        counts.set(a.estadoId, (counts.get(a.estadoId) ?? 0) + 1);
      }
    }
    return [...estados]
      .sort((a, b) => a.orden - b.orden)
      .map((estado) => ({ estado, count: counts.get(estado.id) ?? 0 }));
  }, [activos, estados]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return activos.filter((a) => {
      if (!matchesInventoryFilters(a, systemFilters, customFilters, columnasCatalogo)) {
        return false;
      }

      if (q) {
        const tid = (a.tid ?? a.epc ?? '').toLowerCase();
        const extraVals = Object.values(a.propiedadesExtra ?? {}).join(' ').toLowerCase();
        const matchQ =
          tid.includes(q) ||
          a.sku.toLowerCase().includes(q) ||
          (a.descripcion?.toLowerCase().includes(q) ?? false) ||
          (a.ubicacion?.toLowerCase().includes(q) ?? false) ||
          (a.codigoInterno?.toLowerCase().includes(q) ?? false) ||
          (a.estado?.toLowerCase().includes(q) ?? false) ||
          (a.fecha?.toLowerCase().includes(q) ?? false) ||
          (a.fechaBaja?.toLowerCase().includes(q) ?? false) ||
          extraVals.includes(q) ||
          columnasCatalogo.some((col) =>
            getActivoPropiedadValor(a, col).toLowerCase().includes(q)
          );
        if (!matchQ) return false;
      }

      return true;
    });
  }, [activos, searchTerm, systemFilters, customFilters, columnasCatalogo]);

  const sortedFiltered = useMemo(() => {
    const col = findColumna(sortColumn, columnasActivas);
    return sortActivos(filtered, col, sortDir);
  }, [filtered, sortColumn, sortDir, columnasActivas]);

  useEffect(() => {
    if (pendingFocusId == null) return;
    const visible = sortedFiltered.some((a) => a.id === pendingFocusId);
    if (!visible) {
      if (!activos.some((a) => a.id === pendingFocusId)) {
        setPendingFocusId(null);
        onFocusHandled?.();
      }
      return;
    }
    const id = pendingFocusId;
    setHighlightedId(id);
    setPendingFocusId(null);
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusHandled?.();
    });
  }, [pendingFocusId, sortedFiltered, activos, onFocusHandled]);

  useEffect(() => {
    if (highlightedId == null) return;
    const t = setTimeout(() => setHighlightedId(null), 5000);
    return () => clearTimeout(t);
  }, [highlightedId]);

  const setRowRef = useCallback((id: number, el: HTMLTableRowElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const filteredIds = useMemo(() => new Set(filtered.map((a) => a.id)), [filtered]);
  const selectedInView = useMemo(
    () => [...selectedIds].filter((id) => filteredIds.has(id)),
    [selectedIds, filteredIds]
  );
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const someVisibleSelected =
    filtered.some((a) => selectedIds.has(a.id)) && !allVisibleSelected;

  const openColumnPicker = () => {
    const current = columnasConfig?.visibles ?? columnasActivas.map((c) => c.codigo);
    setDraftColumnas(clampVisibleColumns(current));
    setShowColumnPicker(true);
  };

  const toggleColumn = (codigo: string) => {
    setDraftColumnas((prev) => toggleColumnVisibility(prev, codigo));
  };

  const moveColumn = (codigo: string, dir: -1 | 1) => {
    setDraftColumnas((prev) => {
      const idx = prev.indexOf(codigo);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const saveColumnas = async () => {
    await onSaveColumnas(draftColumnas);
    setShowColumnPicker(false);
  };

  const clearFilters = () => {
    setSystemFilters(EMPTY_SYSTEM_FILTERS);
    setCustomFilters([]);
    setSearchTerm('');
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };

  const canBatchSelect = true;
  const estadosInactivos = useMemo(
    () => estados.filter((e) => estadoEstaDeshabilitado(e)),
    [estados]
  );

  const openBatchModal = (type: BatchModalType) => {
    if (type === 'estado') {
      setBatchEstadoId(estados[0]?.id ?? 0);
      setBatchMotivo('');
    } else if (type === 'ubicacion') {
      setBatchUbicacionId(ubicaciones[0]?.id ?? 0);
    } else {
      setRemoverModo(canChangeEstado ? 'baja' : 'eliminar');
      setBatchEstadoId(estadosInactivos[0]?.id ?? estados[0]?.id ?? 0);
      setBatchMotivo('');
      setConfirmEliminar(false);
    }
    setBatchError(null);
    setBatchModal(type);
  };

  const closeBatchModal = () => {
    setBatchModal(null);
    setBatchError(null);
    setConfirmEliminar(false);
  };

  const handleBatchSubmit = async () => {
    if (selectedInView.length === 0 || !batchModal) return;
    setBatchSubmitting(true);
    setBatchError(null);
    try {
      if (batchModal === 'estado') {
        if (!batchEstadoId) return;
        const batchEstado = estados.find((e) => e.id === batchEstadoId);
        await onBatchUpdateEstado(
          selectedInView,
          batchEstadoId,
          estadoRequiereMotivoBaja(batchEstado) ? batchMotivo || undefined : undefined
        );
      } else if (batchModal === 'ubicacion') {
        if (!batchUbicacionId) return;
        await onBatchUpdateUbicacion(selectedInView, batchUbicacionId);
      } else if (removerModo === 'baja') {
        if (!batchEstadoId) return;
        const batchEstado = estados.find((e) => e.id === batchEstadoId);
        await onBatchUpdateEstado(
          selectedInView,
          batchEstadoId,
          estadoRequiereMotivoBaja(batchEstado) ? batchMotivo || undefined : undefined
        );
      } else {
        if (!confirmEliminar) return;
        const result = await onBatchDelete(selectedInView);
        if (result?.errores?.length) {
          const msg =
            result.mensaje ??
            `${result.errores.length} activo(s) no se pudieron eliminar.`;
          if ((result.total ?? 0) === 0) {
            setBatchError(msg);
            return;
          }
          setBatchError(msg);
        }
      }
      setSelectedIds(new Set());
      closeBatchModal();
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleCopyTid = (tid: string) => {
    navigator.clipboard.writeText(tid);
    setCopiedTid(tid);
    setTimeout(() => setCopiedTid(null), 1500);
  };

  const renderCell = (item: Activo, col: ColumnaTabla) => (
    <ActivoTableCell
      item={item}
      col={col}
      copiedTid={copiedTid}
      onCopyTid={handleCopyTid}
      isQuickEditRow={inlineEdit.isQuickEditRow(item.id)}
      canEditCol={inlineEdit.canEditCol(col, item)}
      editing={inlineEdit.editing}
      estados={estados}
      ubicaciones={ubicaciones}
      awaitingMotivo={inlineEdit.awaitingMotivo}
      onStartFieldEdit={(field, value) =>
        inlineEdit.startFieldEdit(item.id, field, value, col, item)
      }
      onSetEditingValue={(value) =>
        inlineEdit.setEditing((e) => (e ? { ...e, value } : e))
      }
      onCommitField={() => inlineEdit.commitFieldEdit(item, col)}
      onEstadoChange={(estadoId) => inlineEdit.handleEstadoChange(item, estadoId)}
      onMotivoDraftChange={(motivo) =>
        inlineEdit.setAwaitingMotivo((m) => (m ? { ...m, motivo } : m))
      }
      onConfirmMotivoBaja={inlineEdit.confirmMotivoBaja}
      onCancelMotivoBaja={inlineEdit.cancelMotivoBaja}
    />
  );

  const estadosActivos = estados.filter((e) => estadoEstaHabilitado(e));
  const showActionsCol = true;
  const showSelectCol = canBatchSelect;
  const batchEstadoSeleccionado = estados.find((e) => e.id === batchEstadoId);
  const batchRequiereMotivo = estadoRequiereMotivoBaja(batchEstadoSeleccionado);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-[#e2e8f0] flex-shrink-0 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] m-0">Listado de activos</h1>
          <p className="text-[13px] text-[#64748b] mt-1 m-0">
            Visualizando {filtered.length} de {activos.length} registros
            {selectedInView.length > 0 && (
              <span className="text-blue-600 font-semibold"> · {selectedInView.length} seleccionado(s)</span>
            )}
          </p>
        </div>
        <PermAction
          permission={P.inventarioColumnas}
          onClick={openColumnPicker}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-600"
          lockedClassName="hover:bg-transparent"
        >
          <Columns3 size={14} />
          Columnas
        </PermAction>
      </header>

      <div className="p-8 flex-1 flex flex-col overflow-hidden gap-5">
        {estadoCounts.length > 0 && (
          <div
            className="grid gap-4 flex-shrink-0 w-full"
            style={{
              gridTemplateColumns: `repeat(${estadoCounts.length}, minmax(0, 1fr))`,
            }}
          >
            {estadoCounts.map(({ estado, count }) => (
              <EstadoKpi key={estado.id} estado={estado} count={count} />
            ))}
          </div>
        )}

        {/* Búsqueda y filtros */}
        <div className="flex flex-col gap-3 flex-shrink-0">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-sm">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[#64748b]" />
              <input
                type="text"
                placeholder="Búsqueda rápida en todos los campos…"
                className="block w-full pl-10 pr-4 py-2 border border-[#e2e8f0] rounded-[10px] bg-slate-50/50 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold border cursor-pointer transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-[#e2e8f0] text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={16} />
              Filtros por campo
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-600 text-white font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {(activeFilterCount > 0 || searchTerm) && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
              >
                Limpiar todo
              </button>
            )}
          </div>

          {showFilters && (
            <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <ListFilter size={16} className="text-blue-500" />
                Filtros por campo
              </div>
              <InventoryFiltersPanel
                systemFilters={systemFilters}
                customFilters={customFilters}
                customProperties={customFilterProperties}
                estados={estados}
                ubicaciones={ubicaciones}
                onSystemChange={setSystemFilters}
                onCustomChange={setCustomFilters}
              />
            </div>
          )}

          {/* Chips rápidos por estado */}
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            <FilterChip
              active={systemFilters.estadoId === 'all'}
              onClick={() => setSystemFilters((f) => ({ ...f, estadoId: 'all' }))}
            >
              Todos ({activos.length})
            </FilterChip>
            {estadoCounts.map(({ estado, count }) => (
              <FilterChip
                key={estado.id}
                active={systemFilters.estadoId === estado.id}
                onClick={() => setSystemFilters((f) => ({ ...f, estadoId: estado.id }))}
              >
                {estado.nombre} ({count})
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Barra de acciones por lote */}
        {selectedInView.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-sm flex-shrink-0">
            <span className="text-sm font-semibold mr-1">
              {selectedInView.length} activo(s) seleccionado(s)
            </span>
            <PermAction
              permission={P.activosCambiarEstado}
              onClick={() => openBatchModal('estado')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-50"
              lockedClassName="bg-white/20 text-white/80 border border-white/30"
            >
              <CircleDot size={14} />
              Estado
            </PermAction>
            <PermAction
              permission={P.activosEditar}
              onClick={() => openBatchModal('ubicacion')}
              disabled={ubicaciones.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-50 disabled:opacity-50"
              lockedClassName="bg-white/20 text-white/80 border border-white/30"
            >
              <MapPin size={14} />
              Ubicación
            </PermAction>
            <PermAction
              permission={[P.activosCambiarEstado, P.activosEliminar]}
              onClick={() => openBatchModal('remover')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/30 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-white/20"
              lockedClassName="opacity-70"
            >
              <Ban size={14} />
              Deshabilitar / eliminar
            </PermAction>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-sm text-blue-100 hover:text-white cursor-pointer"
            >
              Deseleccionar todo
            </button>
          </div>
        )}

        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="min-w-full text-left">
              <thead className="bg-[#f1f5f9] sticky top-0 z-10">
                <tr>
                  {showSelectCol && (
                    <th className="px-3 py-3 w-10 border-b border-[#e2e8f0]">
                      <button
                        type="button"
                        onClick={toggleSelectAllVisible}
                        className="p-1 text-slate-500 hover:text-blue-600 cursor-pointer"
                        title={allVisibleSelected ? 'Deseleccionar todos' : 'Seleccionar todos visibles'}
                      >
                        {allVisibleSelected ? (
                          <CheckSquare size={16} className="text-blue-600" />
                        ) : someVisibleSelected ? (
                          <MinusSquare size={16} className="text-blue-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                  )}
                  {columnasActivas.map((col) => (
                    <SortableColumnHeader
                      key={col.codigo}
                      label={col.etiqueta}
                      columnKey={col.codigo}
                      sortColumn={sortColumn}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  ))}
                  {showActionsCol && (
                    <th className="px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0]">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {sortedFiltered.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isQuickEditing = inlineEdit.quickEditRowId === item.id;
                  const isHighlighted = highlightedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      ref={(el) => setRowRef(item.id, el)}
                      className={`group ${
                        isHighlighted
                          ? 'bg-violet-100 ring-2 ring-inset ring-violet-400'
                          : isQuickEditing
                            ? 'bg-amber-50/70 ring-1 ring-inset ring-amber-200'
                            : isSelected
                              ? 'bg-blue-50/80'
                              : 'hover:bg-[#f8fafc]'
                      }`}
                    >
                      {showSelectCol && (
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => toggleSelect(item.id)}
                            className="p-1 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-blue-600" />
                            ) : (
                              <Square size={16} className="text-slate-300 group-hover:text-slate-400" />
                            )}
                          </button>
                        </td>
                      )}
                      {columnasActivas.map((col) => (
                        <td key={col.codigo} className="px-4 py-3">
                          {renderCell(item, col)}
                        </td>
                      ))}
                      {showActionsCol && (
                        <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <PermAction
                            permission={P.activosEdicionRapida}
                            onClick={() =>
                              isQuickEditing
                                ? inlineEdit.confirmQuickEdit(item.id)
                                : inlineEdit.toggleQuickEdit(item.id)
                            }
                            title={isQuickEditing ? 'Confirmar edición' : 'Edición rápida'}
                            disabled={!quickEditEnabled}
                            className={`p-1.5 border rounded cursor-pointer ${
                              isQuickEditing
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            lockedClassName="border-slate-200"
                          >
                            {isQuickEditing ? <Check size={13} /> : <Pencil size={13} />}
                          </PermAction>
                          <PermAction
                            permission={P.activosVerHistorial}
                            onClick={() => setDetalleActivo(item)}
                            title="Ver detalles"
                            className="p-1.5 border border-slate-200 text-slate-600 rounded cursor-pointer hover:bg-slate-50"
                            lockedClassName="border-slate-200"
                          >
                            <Eye size={13} />
                          </PermAction>
                          {!item.esActivo && estadosActivos[0] && (
                            <PermAction
                              permission={P.activosCambiarEstado}
                              onClick={() => onUpdateEstado(item.id, estadosActivos[0].id)}
                              className="px-2 py-1 border border-emerald-600 text-emerald-600 rounded text-[11px] font-bold hover:bg-emerald-50 cursor-pointer"
                              lockedClassName="border-slate-300 text-slate-500"
                            >
                              Reactivar
                            </PermAction>
                          )}
                        </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedFiltered.length === 0 && (
              <div className="py-16 text-center text-slate-500 text-sm">Sin resultados</div>
            )}
          </div>
        </div>
      </div>

      {/* Modales de acciones por lote */}
      {batchModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-slate-800 m-0">
                {batchModal === 'estado' && 'Cambiar estado por lote'}
                {batchModal === 'ubicacion' && 'Cambiar ubicación por lote'}
                {batchModal === 'remover' && 'Deshabilitar o eliminar tags'}
              </h2>
              <button
                type="button"
                onClick={closeBatchModal}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 m-0">
                Se aplicará a <strong>{selectedInView.length}</strong> activo(s) seleccionado(s).
              </p>

              {batchModal === 'estado' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      Nuevo estado
                    </label>
                    <select
                      value={batchEstadoId}
                      onChange={(e) => {
                        setBatchEstadoId(Number(e.target.value));
                        setBatchMotivo('');
                      }}
                      className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm"
                    >
                      {estados.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  {batchRequiereMotivo && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                        Motivo de baja
                      </label>
                      <input
                        value={batchMotivo}
                        onChange={(e) => setBatchMotivo(e.target.value)}
                        placeholder="Indique el motivo de la baja…"
                        className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              {batchModal === 'ubicacion' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    Nueva ubicación
                  </label>
                  <select
                    value={batchUbicacionId}
                    onChange={(e) => setBatchUbicacionId(Number(e.target.value))}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm"
                  >
                    {ubicaciones.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {batchModal === 'remover' && (
                <>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    <PermAction
                      permission={P.activosCambiarEstado}
                      onClick={() => setRemoverModo('baja')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md cursor-pointer ${
                        removerModo === 'baja'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Ban size={14} />
                      Dar de baja
                    </PermAction>
                    <PermAction
                      permission={P.activosEliminar}
                      onClick={() => setRemoverModo('eliminar')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md cursor-pointer ${
                        removerModo === 'eliminar'
                          ? 'bg-white text-red-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </PermAction>
                  </div>
                  {removerModo === 'baja' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                          Estado de baja
                        </label>
                        <select
                          value={batchEstadoId}
                          onChange={(e) => {
                            setBatchEstadoId(Number(e.target.value));
                            setBatchMotivo('');
                          }}
                          className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm"
                        >
                          {estadosInactivos.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      {batchRequiereMotivo && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                            Motivo de baja
                          </label>
                          <input
                            value={batchMotivo}
                            onChange={(e) => setBatchMotivo(e.target.value)}
                            placeholder="Indique el motivo de la baja…"
                            className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                      )}
                      <p className="text-xs text-slate-500 m-0">
                        Los tags permanecen en el inventario con estado inactivo.
                      </p>
                    </>
                  )}
                  {removerModo === 'eliminar' && (
                    <div className="space-y-3">
                      <p className="text-sm text-red-600 m-0 bg-red-50 border border-red-100 rounded-lg p-3">
                        Los {selectedInView.length} activo(s) se eliminarán permanentemente del
                        inventario. Esta acción no se puede deshacer.
                      </p>
                      <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmEliminar}
                          onChange={(e) => setConfirmEliminar(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300"
                        />
                        <span>Confirmo que deseo eliminar permanentemente los activos seleccionados.</span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {batchError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 m-0">
                  {batchError}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBatchModal}
                className="px-4 py-2 text-sm text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={
                  batchSubmitting ||
                  (batchModal === 'estado' && (!batchEstadoId || (batchRequiereMotivo && !batchMotivo.trim()))) ||
                  (batchModal === 'ubicacion' && !batchUbicacionId) ||
                  (batchModal === 'remover' &&
                    removerModo === 'baja' &&
                    (!batchEstadoId ||
                      estadosInactivos.length === 0 ||
                      (batchRequiereMotivo && !batchMotivo.trim()))) ||
                  (batchModal === 'remover' && removerModo === 'eliminar' && !confirmEliminar)
                }
                className={`px-4 py-2 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-2 ${
                  batchModal === 'remover' && removerModo === 'eliminar'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {batchSubmitting && <Loader2 size={14} className="animate-spin" />}
                {batchModal === 'estado' && `Aplicar a ${selectedInView.length} activo(s)`}
                {batchModal === 'ubicacion' && `Reubicar ${selectedInView.length} activo(s)`}
                {batchModal === 'remover' &&
                  (removerModo === 'baja'
                    ? `Dar de baja ${selectedInView.length} activo(s)`
                    : `Eliminar ${selectedInView.length} activo(s)`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {columnasConfig && (
        <ColumnPickerModal
          open={showColumnPicker}
          columnasConfig={columnasConfig}
          draftColumnas={draftColumnas}
          onClose={() => setShowColumnPicker(false)}
          onToggle={toggleColumn}
          onMove={moveColumn}
          onSave={saveColumnas}
        />
      )}

      <ActivoDetalleModal
        open={detalleActivo !== null}
        activo={detalleActivo}
        onClose={() => setDetalleActivo(null)}
        estados={estados}
        ubicaciones={ubicaciones}
        columnasConfig={columnasConfig}
        canEdit={canEdit}
        canChangeEstado={canChangeEstado}
        onUpdateActivo={onUpdateActivo}
        onUpdateEstado={onUpdateEstado}
      />
    </div>
  );
}

function EstadoKpi({ estado, count }: { estado: Estado; count: number }) {
  const color = estado.color || '#64748b';
  return (
    <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm flex justify-between items-center min-w-0 h-full">
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-[#64748b] font-bold uppercase truncate block">
          {estado.nombre}
        </span>
        <div className="text-2xl font-mono font-bold truncate" style={{ color }}>
          {count}
        </div>
      </div>
      <div
        className="p-2.5 rounded-lg shrink-0 ml-2"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <CircleDot size={18} />
      </div>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
        active ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'
      }`}
    >
      {children}
    </button>
  );
}

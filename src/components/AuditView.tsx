import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScanLine,
  CheckCircle,
  AlertCircle,
  Loader2,
  Columns3,
  Square,
  ExternalLink,
  History,
  Save,
  User,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import ActivoTableCell, { TidOnlyCell } from './ActivoTableCell';
import ColumnPickerModal from './ColumnPickerModal';
import AuditoriaDetalleModal from './AuditoriaDetalleModal';
import ScanTidsModal from './ScanTidsModal';
import SortableColumnHeader, { useColumnSortState } from './SortableColumnHeader';
import { findColumna, sortAuditRows } from '../utils/tableSort';
import { DEFAULT_INVENTORY_COLUMNS, toggleColumnVisibility, clampVisibleColumns } from '../constants/inventoryColumns';
import type { Activo, AuditoriaResumen, ColumnaTabla, InventarioColumnasConfig } from '../types';

interface AuditRow {
  tid: string;
  registrado: boolean;
  activo: Activo | null;
}

type ViewTab = 'curso' | 'historial';

interface Props {
  activos: Activo[];
  columnasConfig: InventarioColumnasConfig | null;
  onSaveColumnas: (columnas: string[]) => Promise<void>;
  canConfigColumnas: boolean;
  canGoToInventario: boolean;
  canGuardarAuditoria: boolean;
  canVerHistorial: boolean;
  onGoToRecord: (activo: Activo) => void;
}

const noop = () => {};

function nowLocalSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export default function AuditView({
  activos,
  columnasConfig,
  onSaveColumnas,
  canConfigColumnas,
  canGoToInventario,
  canGuardarAuditoria,
  canVerHistorial,
  onGoToRecord,
}: Props) {
  const [viewTab, setViewTab] = useState<ViewTab>('curso');
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [readTids, setReadTids] = useState<string[]>([]);
  const [auditStartedAt, setAuditStartedAt] = useState<string | null>(null);
  const [auditNotas, setAuditNotas] = useState('');
  const [copiedTid, setCopiedTid] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [draftColumnas, setDraftColumnas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<AuditoriaResumen[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [detalleAuditoriaId, setDetalleAuditoriaId] = useState<number | null>(null);

  const columnasActivas = columnasConfig?.columnasActivas ?? DEFAULT_INVENTORY_COLUMNS;

  const loadHistorial = useCallback(async () => {
    if (!canVerHistorial) return;
    setHistorialLoading(true);
    try {
      setHistorial(await api.getAuditorias());
    } catch {
      setHistorial([]);
    } finally {
      setHistorialLoading(false);
    }
  }, [canVerHistorial]);

  useEffect(() => {
    loadHistorial();
  }, [loadHistorial]);

  const activoByTid = useMemo(() => {
    const map = new Map<string, Activo>();
    for (const a of activos) {
      const tid = (a.tid ?? a.epc ?? '').toUpperCase();
      if (tid) map.set(tid, a);
    }
    return map;
  }, [activos]);

  const rows: AuditRow[] = useMemo(
    () =>
      readTids.map((tid) => {
        const activo = activoByTid.get(tid) ?? null;
        return { tid, registrado: !!activo, activo };
      }),
    [readTids, activoByTid]
  );

  const { sortColumn, sortDir, toggleSort } = useColumnSortState();
  const sortedRows = useMemo(() => {
    const col = findColumna(sortColumn, columnasActivas);
    return sortAuditRows(rows, col, sortDir);
  }, [rows, sortColumn, sortDir, columnasActivas]);

  const registrados = rows.filter((r) => r.registrado).length;
  const desconocidos = rows.length - registrados;

  const openAuditModal = () => {
    setSaveMessage(null);
    setSaveError(null);
    setAuditStartedAt((prev) => prev ?? nowLocalSql());
    setAuditModalOpen(true);
  };

  const handleSaveAudit = async () => {
    if (readTids.length === 0 || !canGuardarAuditoria) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const result = await api.saveAuditoria({
        tids: readTids,
        fechaInicio: auditStartedAt ?? undefined,
        notas: auditNotas.trim() || undefined,
      });
      setSaveMessage(
        `Auditoría #${result.id} guardada — ${result.total} etiqueta(s): ${result.registrados} en inventario, ${result.desconocidos} no registrada(s).`
      );
      await loadHistorial();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar la auditoría');
    } finally {
      setSaving(false);
    }
  };

  const handleNewAudit = () => {
    setReadTids([]);
    setAuditStartedAt(null);
    setAuditNotas('');
    setSaveMessage(null);
    setSaveError(null);
  };

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

  const handleCopyTid = (tid: string) => {
    navigator.clipboard.writeText(tid);
    setCopiedTid(tid);
    setTimeout(() => setCopiedTid(null), 1500);
  };

  const renderAuditCell = (row: AuditRow, col: ColumnaTabla) => {
    if (row.activo) {
      const item = row.activo;
      return (
        <ActivoTableCell
          item={item}
          col={col}
          copiedTid={copiedTid}
          onCopyTid={handleCopyTid}
          isQuickEditRow={false}
          canEditCol={false}
          editing={null}
          estados={[]}
          ubicaciones={[]}
          awaitingMotivo={null}
          onStartFieldEdit={noop}
          onSetEditingValue={noop}
          onCommitField={noop}
          onEstadoChange={noop}
          onMotivoDraftChange={noop}
          onConfirmMotivoBaja={noop}
          onCancelMotivoBaja={noop}
        />
      );
    }
    if (col.codigo === 'epc') {
      return (
        <TidOnlyCell tid={row.tid} onCopy={handleCopyTid} copied={copiedTid === row.tid} />
      );
    }
    return <span className="text-[13px] text-slate-300">—</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-[#e2e8f0] flex justify-between items-start gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a] m-0">Auditoría rápida</h1>
          <p className="text-[13px] text-[#64748b] mt-1 m-0">
            Lectura masiva con lector RFID — {activos.length} activos en inventario. Guarde cada
            auditoría para consultarla después.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canConfigColumnas && columnasConfig && (
            <button
              type="button"
              onClick={openColumnPicker}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-600"
            >
              <Columns3 size={14} />
              Columnas
            </button>
          )}
        </div>
      </header>

      {canVerHistorial && (
        <div className="px-8 pt-4 flex gap-1 flex-shrink-0">
          <TabButton active={viewTab === 'curso'} onClick={() => setViewTab('curso')}>
            Auditoría en curso
          </TabButton>
          <TabButton active={viewTab === 'historial'} onClick={() => setViewTab('historial')}>
            <History size={14} />
            Historial guardado
            {historial.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-violet-100 text-violet-700 font-bold">
                {historial.length}
              </span>
            )}
          </TabButton>
        </div>
      )}

      <div className="p-8 flex-1 flex flex-col gap-5 overflow-hidden min-h-0">
        {viewTab === 'historial' ? (
          <HistorialPanel
            historial={historial}
            loading={historialLoading}
            onSelect={(id) => setDetalleAuditoriaId(id)}
            onRefresh={loadHistorial}
          />
        ) : (
          <>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm flex flex-wrap items-center gap-4 flex-shrink-0">
              <button
                type="button"
                onClick={openAuditModal}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
              >
                <ScanLine size={18} />
                {readTids.length > 0 ? 'Agregar más etiquetas' : 'Agregar etiquetas'}
              </button>

              {readTids.length > 0 && canGuardarAuditoria && (
                <button
                  type="button"
                  onClick={handleSaveAudit}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar auditoría
                </button>
              )}

              {readTids.length > 0 && (
                <button
                  type="button"
                  onClick={handleNewAudit}
                  className="px-4 py-2.5 text-sm text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  Nueva auditoría
                </button>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
                <ScanLine size={16} />
                Ingrese TID manualmente
              </div>
            </div>

            {readTids.length > 0 && canGuardarAuditoria && (
              <div className="flex-shrink-0">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Notas de la auditoría (opcional)
                </label>
                <input
                  value={auditNotas}
                  onChange={(e) => setAuditNotas(e.target.value)}
                  placeholder="Ej. Auditoría canasto piscina, turno mañana…"
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            )}

            {saveMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm flex gap-3 items-center flex-shrink-0">
                <CheckCircle size={18} />
                {saveMessage}
              </div>
            )}
            {saveError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex gap-3 items-center flex-shrink-0">
                <AlertCircle size={18} />
                {saveError}
              </div>
            )}

            {readTids.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                  <StatCard label="Tags leídos" value={rows.length} />
                  <StatCard label="En inventario" value={registrados} color="text-emerald-600" />
                  <StatCard label="No registrados" value={desconocidos} color="text-amber-600" />
                </div>

                <div className="bg-white border border-[#e2e8f0] rounded-xl flex-1 overflow-hidden flex flex-col min-h-0 shadow-sm">
                  <div className="overflow-auto flex-1">
                    <table className="min-w-full text-left">
                      <thead className="bg-[#f1f5f9] sticky top-0 z-10">
                        <tr>
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
                          <th className="px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0]">
                            Acciones
                          </th>
                          <th className="px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0]">
                            Resultado auditoría
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {sortedRows.map((row) => (
                          <tr
                            key={row.tid}
                            className={`group hover:bg-[#f8fafc] ${
                              !row.registrado ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            {columnasActivas.map((col) => (
                              <td key={col.codigo} className="px-4 py-3">
                                {renderAuditCell(row, col)}
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              {row.activo && canGoToInventario ? (
                                <button
                                  type="button"
                                  onClick={() => onGoToRecord(row.activo!)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 cursor-pointer whitespace-nowrap"
                                >
                                  <ExternalLink size={13} />
                                  Ir a registro
                                </button>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.registrado ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                                  <CheckCircle size={14} /> En inventario
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold">
                                  <AlertCircle size={14} /> No registrado
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {readTids.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 border border-dashed border-slate-200 rounded-xl bg-white/50">
                <Square size={40} className="opacity-30" />
                <p className="text-sm m-0">Pulse «Agregar etiquetas» para comenzar la auditoría</p>
              </div>
            )}
          </>
        )}
      </div>

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

      <ScanTidsModal
        open={auditModalOpen}
        mockEnabled={false}
        onClose={() => setAuditModalOpen(false)}
        onConfirm={(tids) => {
          setReadTids((prev) => {
            const set = new Set(prev);
            for (const t of tids) set.add(t);
            return [...set];
          });
        }}
      />

      <AuditoriaDetalleModal
        open={detalleAuditoriaId !== null}
        auditoriaId={detalleAuditoriaId}
        onClose={() => setDetalleAuditoriaId(null)}
        activos={activos}
        canGoToInventario={canGoToInventario}
        onGoToRecord={onGoToRecord}
      />
    </div>
  );
}

function TabButton({
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
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-colors ${
        active
          ? 'bg-violet-600 text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function HistorialPanel({
  historial,
  loading,
  onSelect,
  onRefresh,
}: {
  historial: AuditoriaResumen[];
  loading: boolean;
  onSelect: (id: number) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <History size={16} className="text-violet-600" />
          Auditorías guardadas
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs font-semibold text-violet-700 hover:underline cursor-pointer disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && historial.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
            <Loader2 size={24} className="animate-spin text-violet-400" />
            <p className="text-sm m-0">Cargando historial…</p>
          </div>
        ) : historial.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400 gap-2 px-6 text-center">
            <History size={36} className="opacity-30" />
            <p className="text-sm m-0">Aún no hay auditorías guardadas.</p>
            <p className="text-xs m-0">Complete una lectura y pulse «Guardar auditoría».</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {historial.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 cursor-pointer flex items-center gap-4 group"
                >
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-sm">
                    #{a.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} />
                        {a.fechaFin}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User size={12} />
                        {a.usuarioNombre || a.usuarioUsername || 'Usuario desconocido'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 m-0 mt-1">
                      {a.totalLeidos} etiqueta{a.totalLeidos !== 1 ? 's' : ''} —{' '}
                      <span className="text-emerald-600">{a.totalRegistrados} en inventario</span>
                      {a.totalDesconocidos > 0 && (
                        <span className="text-amber-600"> · {a.totalDesconocidos} no registrada{a.totalDesconocidos !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                    {a.notas && (
                      <p className="text-xs text-slate-500 m-0 mt-1 truncate">{a.notas}</p>
                    )}
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-slate-300 group-hover:text-violet-500 shrink-0"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'text-[#0f172a]',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
      <div className="text-[10px] text-[#64748b] font-bold uppercase">{label}</div>
      <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}

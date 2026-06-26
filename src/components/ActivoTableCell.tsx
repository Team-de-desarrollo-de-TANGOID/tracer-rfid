import { Tag, Copy, Check } from 'lucide-react';
import type { Activo, ColumnaTabla, Estado, Ubicacion } from '../types';
import type { AwaitingMotivoBaja, EditingField } from '../hooks/useActivoInlineEdit';
import { activoPermiteEditarMotivoBaja } from '../utils/activoEdit';
import { getActivoPropiedadValor } from '../utils/activoProps';

interface Props {
  item: Activo;
  col: ColumnaTabla;
  copiedTid: string | null;
  onCopyTid: (tid: string) => void;
  isQuickEditRow: boolean;
  canEditCol: boolean;
  editing: EditingField | null;
  estados: Estado[];
  ubicaciones: Ubicacion[];
  awaitingMotivo: AwaitingMotivoBaja | null;
  onStartFieldEdit: (field: string, value: string) => void;
  onSetEditingValue: (value: string) => void;
  onCommitField: () => void;
  onEstadoChange: (estadoId: number) => void;
  onMotivoDraftChange: (motivo: string) => void;
  onConfirmMotivoBaja: () => void;
  onCancelMotivoBaja: () => void;
}

export default function ActivoTableCell({
  item,
  col,
  copiedTid,
  onCopyTid,
  isQuickEditRow,
  canEditCol,
  editing,
  estados,
  ubicaciones,
  awaitingMotivo,
  onStartFieldEdit,
  onSetEditingValue,
  onCommitField,
  onEstadoChange,
  onMotivoDraftChange,
  onConfirmMotivoBaja,
  onCancelMotivoBaja,
}: Props) {
  const isEditingThis =
    editing?.id === item.id && editing.field === col.codigo;
  const showAwaitingMotivo =
    col.codigo === 'estado' &&
    awaitingMotivo?.activoId === item.id &&
    isQuickEditRow;

  switch (col.codigo) {
    case 'epc': {
      const tid = item.tid ?? item.epc ?? '';
      return (
        <div className="flex items-center gap-2">
          <Tag size={13} className="text-indigo-400 shrink-0" />
          <span
            className={`text-[13px] font-mono font-semibold ${
              item.esActivo ? 'text-[#0f172a]' : 'text-slate-400 line-through'
            }`}
          >
            {tid}
          </span>
          <button
            type="button"
            onClick={() => onCopyTid(tid)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
          >
            {copiedTid === tid ? (
              <Check size={11} className="text-emerald-600" />
            ) : (
              <Copy size={11} />
            )}
          </button>
        </div>
      );
    }
    case 'sku':
      return <span className="text-[13px] text-[#64748b]">{item.sku}</span>;
    case 'estado':
      if (canEditCol) {
        return (
          <div className="space-y-1.5 min-w-[140px]">
            <select
              value={awaitingMotivo?.activoId === item.id ? awaitingMotivo.estadoId : item.estadoId}
              onChange={(e) => onEstadoChange(Number(e.target.value))}
              className="text-[11px] font-bold rounded-full px-2 py-1 border border-slate-200 cursor-pointer w-full"
              style={{ backgroundColor: `${item.estadoColor}22`, color: item.estadoColor }}
            >
              {estados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            {showAwaitingMotivo && (
              <div className="flex flex-col gap-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-[10px] font-bold text-amber-800 uppercase">Motivo de baja</span>
                <input
                  autoFocus
                  value={awaitingMotivo.motivo}
                  onChange={(e) => onMotivoDraftChange(e.target.value)}
                  placeholder="Indique el motivo…"
                  className="text-xs border border-amber-200 rounded px-2 py-1 w-full"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onConfirmMotivoBaja();
                    if (e.key === 'Escape') onCancelMotivoBaja();
                  }}
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={onConfirmMotivoBaja}
                    className="text-[10px] font-bold text-emerald-700 cursor-pointer"
                  >
                    Confirmar baja
                  </button>
                  <button
                    type="button"
                    onClick={onCancelMotivoBaja}
                    className="text-[10px] text-slate-500 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }
      return (
        <span
          className="px-2.5 py-1 text-[11px] font-bold rounded-full inline-block"
          style={{ backgroundColor: `${item.estadoColor}22`, color: item.estadoColor }}
        >
          {item.estado}
        </span>
      );
    case 'ubicacion':
      if (isEditingThis) {
        return (
          <select
            autoFocus
            value={editing.value}
            onChange={(e) => onSetEditingValue(e.target.value)}
            onBlur={onCommitField}
            className="text-[13px] border rounded px-2 py-1 w-full"
          >
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.nombre}
              </option>
            ))}
          </select>
        );
      }
      return (
        <span
          className={`text-[13px] text-[#64748b] ${
            canEditCol ? 'cursor-pointer hover:underline decoration-dotted' : ''
          } ${isQuickEditRow && canEditCol ? 'ring-1 ring-transparent hover:ring-blue-200 rounded px-1 -mx-1' : ''}`}
          onClick={() => canEditCol && onStartFieldEdit('ubicacion', item.ubicacion ?? '')}
          title={canEditCol ? 'Clic para editar' : undefined}
        >
          {item.ubicacion || '—'}
        </span>
      );
    case 'descripcion':
      if (isEditingThis) {
        return (
          <input
            autoFocus
            value={editing.value}
            onChange={(e) => onSetEditingValue(e.target.value)}
            onBlur={onCommitField}
            onKeyDown={(e) => e.key === 'Enter' && onCommitField()}
            className="text-[13px] border rounded px-2 py-1 w-full"
          />
        );
      }
      return (
        <span
          className={`text-[13px] text-[#64748b] ${canEditCol ? 'cursor-pointer hover:underline decoration-dotted' : ''}`}
          onClick={() => canEditCol && onStartFieldEdit('descripcion', item.descripcion ?? '')}
          title={canEditCol ? 'Clic para editar' : undefined}
        >
          {item.descripcion || '—'}
        </span>
      );
    case 'codigo_interno':
      if (isEditingThis) {
        return (
          <input
            autoFocus
            value={editing.value}
            onChange={(e) => onSetEditingValue(e.target.value)}
            onBlur={onCommitField}
            onKeyDown={(e) => e.key === 'Enter' && onCommitField()}
            className="text-[13px] font-mono border rounded px-2 py-1 w-full"
          />
        );
      }
      return (
        <span
          className={`text-[13px] font-mono text-[#64748b] ${canEditCol ? 'cursor-pointer hover:underline decoration-dotted' : ''}`}
          onClick={() => canEditCol && onStartFieldEdit('codigo_interno', item.codigoInterno ?? '')}
          title={canEditCol ? 'Clic para editar' : undefined}
        >
          {item.codigoInterno || '—'}
        </span>
      );
    case 'fecha_registro':
      return <span className="text-[13px] text-[#64748b]">{item.fecha}</span>;
    case 'fecha_baja':
      return <span className="text-[13px] text-[#64748b]">{item.fechaBaja || '—'}</span>;
    case 'motivo_baja':
      if (!activoPermiteEditarMotivoBaja(item) && !canEditCol) {
        return <span className="text-[13px] text-slate-300">—</span>;
      }
      if (isEditingThis) {
        return (
          <input
            autoFocus
            value={editing.value}
            onChange={(e) => onSetEditingValue(e.target.value)}
            onBlur={onCommitField}
            onKeyDown={(e) => e.key === 'Enter' && onCommitField()}
            className="text-[13px] border rounded px-2 py-1 w-full"
            placeholder="Motivo de baja"
          />
        );
      }
      return (
        <span
          className={`text-[13px] text-[#64748b] ${canEditCol ? 'cursor-pointer hover:underline decoration-dotted' : ''}`}
          onClick={() => canEditCol && onStartFieldEdit('motivo_baja', item.motivoBaja ?? '')}
          title={canEditCol ? 'Clic para editar' : undefined}
        >
          {item.motivoBaja || '—'}
        </span>
      );
    default: {
      if (!col.esCustom) {
        return <span className="text-[13px] text-slate-400">—</span>;
      }
      const valor = getActivoPropiedadValor(item, col);
      const inputType = col.tipo === 'numero' ? 'number' : col.tipo === 'fecha' ? 'date' : 'text';
      if (isEditingThis) {
        return (
          <input
            autoFocus
            type={inputType}
            value={editing.value}
            onChange={(e) => onSetEditingValue(e.target.value)}
            onBlur={() => onCommitField()}
            onKeyDown={(e) => e.key === 'Enter' && onCommitField()}
            className="text-[13px] border rounded px-2 py-1 w-full"
          />
        );
      }
      return (
        <span
          className={`text-[13px] text-[#64748b] ${canEditCol ? 'cursor-pointer hover:underline decoration-dotted' : ''}`}
          onClick={() => canEditCol && onStartFieldEdit(col.codigo, valor)}
          title={canEditCol ? 'Clic para editar' : undefined}
        >
          {valor || '—'}
        </span>
      );
    }
  }
}

export function TidOnlyCell({ tid, onCopy, copied }: { tid: string; onCopy: (t: string) => void; copied: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Tag size={13} className="text-indigo-400 shrink-0" />
      <span className="text-[13px] font-mono font-semibold text-[#0f172a]">{tid}</span>
      <button
        type="button"
        onClick={() => onCopy(tid)}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
      >
        {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
      </button>
    </div>
  );
}

export function getEditableVisibleColumns(columnas: ColumnaTabla[]) {
  return columnas.filter((c) => c.editable);
}

export function getAllEditableColumns(columnas: ColumnaTabla[] | undefined) {
  return columnas?.filter((c) => c.editable) ?? [];
}

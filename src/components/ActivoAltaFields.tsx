import { CircleDot, MapPin, Package, FileText } from 'lucide-react';
import type { ColumnaTabla, Estado, Sku, Ubicacion } from '../types';

interface Props {
  fields: ColumnaTabla[];
  skuId: number;
  estadoId: number;
  ubicacionId: number;
  fieldValues: Record<string, string>;
  skus: Sku[];
  estados: Estado[];
  ubicaciones: Ubicacion[];
  disabled?: boolean;
  onSkuId: (id: number) => void;
  onEstadoId: (id: number) => void;
  onUbicacionId: (id: number) => void;
  onFieldValue: (codigo: string, value: string) => void;
  fieldClass: string;
  labelClass: string;
}

export default function ActivoAltaFields({
  fields,
  skuId,
  estadoId,
  ubicacionId,
  fieldValues,
  skus,
  estados,
  ubicaciones,
  disabled = false,
  onSkuId,
  onEstadoId,
  onUbicacionId,
  onFieldValue,
  fieldClass,
  labelClass,
}: Props) {
  const ubicacionesActivas = ubicaciones.filter((u) => u.activo);

  if (fields.length === 0) {
    return (
      <p className="text-xs text-slate-400 m-0">
        Cargando propiedades del activo…
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {fields.map((col) => {
        const spanFull = col.codigo === 'estado' ? 'sm:col-span-2' : '';
        switch (col.codigo) {
          case 'sku':
            return (
              <div key={col.codigo} className={spanFull}>
                <label className={labelClass}>
                  <Package size={12} className="inline mr-1 -mt-0.5" />
                  {col.etiqueta}
                </label>
                <select
                  value={skuId}
                  disabled={disabled}
                  onChange={(e) => onSkuId(Number(e.target.value))}
                  className={fieldClass}
                >
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.codigo} — {s.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            );

          case 'ubicacion':
            return (
              <div key={col.codigo} className={spanFull}>
                <label className={labelClass}>
                  <MapPin size={12} className="inline mr-1 -mt-0.5" />
                  {col.etiqueta}
                </label>
                <select
                  value={ubicacionId}
                  disabled={disabled}
                  onChange={(e) => onUbicacionId(Number(e.target.value))}
                  className={fieldClass}
                >
                  {ubicacionesActivas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                      {u.descripcion ? ` — ${u.descripcion}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            );

          case 'estado':
            return (
              <div key={col.codigo} className={spanFull}>
                <label className={labelClass}>
                  <CircleDot size={12} className="inline mr-1 -mt-0.5" />
                  {col.etiqueta}
                </label>
                <div className="flex flex-wrap gap-2">
                  {estados.map((est) => (
                    <button
                      key={est.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onEstadoId(est.id)}
                      className={`py-2 px-4 border rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        estadoId === est.id ? 'shadow-sm' : 'border-slate-200 hover:border-slate-300'
                      }`}
                      style={
                        estadoId === est.id
                          ? {
                              borderColor: est.color,
                              backgroundColor: `${est.color}14`,
                              color: est.color,
                              boxShadow: `0 0 0 2px white, 0 0 0 4px ${est.color}55`,
                            }
                          : {}
                      }
                    >
                      {est.nombre}
                    </button>
                  ))}
                </div>
              </div>
            );

          case 'descripcion':
            return (
              <div key={col.codigo} className={spanFull}>
                <label className={labelClass}>
                  <FileText size={12} className="inline mr-1 -mt-0.5" />
                  {col.etiqueta}
                </label>
                <input
                  value={fieldValues[col.codigo] ?? ''}
                  disabled={disabled}
                  onChange={(e) => onFieldValue(col.codigo, e.target.value)}
                  className={fieldClass}
                  placeholder={col.etiqueta}
                />
              </div>
            );

          case 'codigo_interno':
            return (
              <div key={col.codigo} className={spanFull}>
                <label className={labelClass}>{col.etiqueta}</label>
                <input
                  value={fieldValues[col.codigo] ?? ''}
                  disabled={disabled}
                  onChange={(e) => onFieldValue(col.codigo, e.target.value)}
                  className={`${fieldClass} font-mono`}
                  placeholder={col.etiqueta}
                />
              </div>
            );

          default:
            if (!col.esCustom) return null;
            return (
              <div key={col.codigo} className={spanFull}>
                <label className={labelClass}>{col.etiqueta}</label>
                <input
                  type={
                    col.tipo === 'numero' ? 'number' : col.tipo === 'fecha' ? 'date' : 'text'
                  }
                  value={fieldValues[col.codigo] ?? ''}
                  disabled={disabled}
                  onChange={(e) => onFieldValue(col.codigo, e.target.value)}
                  className={fieldClass}
                  placeholder={col.etiqueta}
                />
              </div>
            );
        }
      })}
    </div>
  );
}

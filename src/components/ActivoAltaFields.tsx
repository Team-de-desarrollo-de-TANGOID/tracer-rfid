import { type ReactNode } from 'react';
import { CircleDot, MapPin, Package, FileText } from 'lucide-react';
import StyledSelect from './StyledSelect';
import PropiedadListaField from './PropiedadListaField';
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
  visibleCodigos?: string[];
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
  visibleCodigos,
  onSkuId,
  onEstadoId,
  onUbicacionId,
  onFieldValue,
  fieldClass,
  labelClass,
}: Props) {
  const ubicacionesActivas = ubicaciones.filter((u) => u.activo);
  const selectedSku = skus.find((s) => s.id === skuId);
  const selectedUbicacion = ubicacionesActivas.find((u) => u.id === ubicacionId);
  const fieldsToRender = visibleCodigos
    ? fields.filter((f) => visibleCodigos.includes(f.codigo))
    : fields;

  const fieldLabel = (col: ColumnaTabla, content: ReactNode) => (
    <label className={labelClass}>
      {content}
      {col.etiqueta}
      {col.obligatoriaAlta && (
        <span className="text-red-500 ml-0.5" title="Campo obligatorio">
          *
        </span>
      )}
    </label>
  );

  if (fields.length === 0) {
    return (
      <p className="text-xs text-slate-400 m-0 text-center">
        Cargando propiedades del activo…
      </p>
    );
  }

  if (fieldsToRender.length === 0) {
    return null;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {fieldsToRender.map((col) => {
        const spanFull =
          col.codigo === 'estado' || col.codigo === 'sku' ? 'sm:col-span-2' : '';
        switch (col.codigo) {
          case 'sku':
            return (
              <div key={col.codigo} className={spanFull}>
                {fieldLabel(col, <Package size={12} className="inline mr-1 -mt-0.5" />)}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="w-full sm:max-w-[11rem] shrink-0">
                    <StyledSelect
                      value={skuId}
                      disabled={disabled}
                      placeholder="SKU…"
                      options={skus.map((s) => ({
                        value: s.id,
                        label: s.codigo,
                      }))}
                      onChange={onSkuId}
                    />
                  </div>
                  {selectedSku?.descripcion && (
                    <p
                      className="text-xs text-slate-500 m-0 pt-2.5 sm:pt-2 min-w-0 leading-snug"
                      title={selectedSku.descripcion}
                    >
                      {selectedSku.descripcion}
                    </p>
                  )}
                </div>
              </div>
            );

          case 'ubicacion':
            return (
              <div key={col.codigo} className={spanFull}>
                {fieldLabel(col, <MapPin size={12} className="inline mr-1 -mt-0.5" />)}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="w-full sm:max-w-[14rem] shrink-0">
                    <StyledSelect
                      value={ubicacionId}
                      disabled={disabled}
                      placeholder="Ubicación…"
                      options={ubicacionesActivas.map((u) => ({
                        value: u.id,
                        label: u.nombre,
                      }))}
                      onChange={onUbicacionId}
                    />
                  </div>
                  {selectedUbicacion?.descripcion && (
                    <p
                      className="text-xs text-slate-500 m-0 pt-2.5 sm:pt-2 min-w-0 leading-snug"
                      title={selectedUbicacion.descripcion}
                    >
                      {selectedUbicacion.descripcion}
                    </p>
                  )}
                </div>
              </div>
            );

          case 'estado':
            return (
              <div key={col.codigo} className={spanFull}>
                {fieldLabel(col, <CircleDot size={12} className="inline mr-1 -mt-0.5" />)}
                <div className="flex flex-wrap gap-2 justify-center">
                  {estados.map((est) => (
                    <button
                      key={est.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onEstadoId(est.id)}
                      className={`py-2 px-4 border rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        estadoId === est.id
                          ? 'shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
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
                {fieldLabel(col, <FileText size={12} className="inline mr-1 -mt-0.5" />)}
                <input
                  value={fieldValues[col.codigo] ?? ''}
                  disabled={disabled}
                  onChange={(e) => onFieldValue(col.codigo, e.target.value)}
                  className={fieldClass}
                  placeholder={`Ingresá ${col.etiqueta.toLowerCase()}…`}
                />
              </div>
            );

          case 'codigo_interno':
            return (
              <div key={col.codigo} className={spanFull}>
                {fieldLabel(col, null)}
                <input
                  value={fieldValues[col.codigo] ?? ''}
                  disabled={disabled}
                  onChange={(e) => onFieldValue(col.codigo, e.target.value)}
                  className={`${fieldClass} font-mono`}
                  placeholder={`Ingresá ${col.etiqueta.toLowerCase()}…`}
                />
              </div>
            );

          default:
            if (!col.esCustom) return null;
            if (col.tipo === 'lista') {
              return (
                <div key={col.codigo} className={spanFull}>
                  {fieldLabel(col, null)}
                  <PropiedadListaField
                    col={col}
                    value={fieldValues[col.codigo] ?? ''}
                    disabled={disabled}
                    onChange={(v) => onFieldValue(col.codigo, v)}
                  />
                </div>
              );
            }
            return (
              <div key={col.codigo} className={spanFull}>
                {fieldLabel(col, null)}
                <input
                  type={
                    col.tipo === 'numero' ? 'number' : col.tipo === 'fecha' ? 'date' : 'text'
                  }
                  value={fieldValues[col.codigo] ?? ''}
                  disabled={disabled}
                  onChange={(e) => onFieldValue(col.codigo, e.target.value)}
                  className={fieldClass}
                  placeholder={`Ingresá ${col.etiqueta.toLowerCase()}…`}
                />
              </div>
            );
        }
      })}
    </div>
  );
}

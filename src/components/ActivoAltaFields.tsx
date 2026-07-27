import { type ReactNode } from 'react';
import { CircleDot, MapPin, Package, FileText, Layers3, SlidersHorizontal } from 'lucide-react';
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

const CORE_CODIGOS = new Set(['sku', 'estado', 'ubicacion', 'descripcion', 'codigo_interno']);

function FormSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="m-0 text-sm font-bold text-slate-900">{title}</h3>
          {hint ? <p className="m-0 mt-0.5 text-xs text-slate-500 leading-snug">{hint}</p> : null}
        </div>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

function FieldShell({
  label,
  required,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
        {required ? (
          <span className="text-red-500 ml-0.5" title="Campo obligatorio">
            *
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
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
}: Props) {
  const ubicacionesActivas = ubicaciones.filter((u) => u.activo);
  const selectedSku = skus.find((s) => s.id === skuId);
  const selectedUbicacion = ubicacionesActivas.find((u) => u.id === ubicacionId);
  const fieldsToRender = visibleCodigos
    ? fields.filter((f) => visibleCodigos.includes(f.codigo))
    : fields;

  if (fields.length === 0) {
    return (
      <p className="text-xs text-slate-400 m-0 text-center py-8">
        Cargando propiedades del activo…
      </p>
    );
  }

  if (fieldsToRender.length === 0) {
    return null;
  }

  const byCodigo = new Map(fieldsToRender.map((f) => [f.codigo, f]));
  const skuCol = byCodigo.get('sku');
  const estadoCol = byCodigo.get('estado');
  const ubicacionCol = byCodigo.get('ubicacion');
  const descripcionCol = byCodigo.get('descripcion');
  const codigoInternoCol = byCodigo.get('codigo_interno');
  const customFields = fieldsToRender.filter((f) => f.esCustom && !CORE_CODIGOS.has(f.codigo));

  const inputClass = `${fieldClass} rounded-xl`;

  return (
    <div className="space-y-4">
      {(skuCol || codigoInternoCol) && (
        <FormSection
          icon={<Package size={15} />}
          title="Clasificación"
          hint="Tipo de producto y código de referencia del activo."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skuCol && (
              <FieldShell label={skuCol.etiqueta} required={skuCol.obligatoriaAlta} className="md:col-span-2">
                <StyledSelect
                  value={skuId}
                  disabled={disabled}
                  placeholder="Seleccioná un SKU…"
                  options={skus.map((s) => ({
                    value: s.id,
                    label: s.descripcion ? `${s.codigo} — ${s.descripcion}` : s.codigo,
                  }))}
                  onChange={onSkuId}
                />
                {selectedSku?.descripcion ? (
                  <p className="m-0 mt-2 text-xs text-slate-500 leading-snug">
                    SKU seleccionado:{' '}
                    <span className="font-medium text-slate-700">{selectedSku.codigo}</span>
                    {' · '}
                    {selectedSku.descripcion}
                  </p>
                ) : null}
              </FieldShell>
            )}
            {codigoInternoCol && (
              <FieldShell
                label={codigoInternoCol.etiqueta}
                required={codigoInternoCol.obligatoriaAlta}
                className={skuCol ? 'md:col-span-2' : ''}
              >
                <input
                  value={fieldValues[codigoInternoCol.codigo] ?? ''}
                  disabled={disabled}
                  onChange={(e) => onFieldValue(codigoInternoCol.codigo, e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="Ej. INT-001234"
                />
              </FieldShell>
            )}
          </div>
        </FormSection>
      )}

      {estadoCol && (
        <FormSection
          icon={<CircleDot size={15} />}
          title="Estado operativo"
          hint="Definí en qué condición ingresa el activo al inventario."
        >
          <div className="flex flex-wrap gap-2">
            {estados.map((est) => {
              const active = estadoId === est.id;
              return (
                <button
                  key={est.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onEstadoId(est.id)}
                  className={`inline-flex items-center gap-2 py-2.5 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                    active
                      ? 'shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  style={
                    active
                      ? {
                          borderColor: est.color,
                          backgroundColor: `${est.color}14`,
                          color: est.color,
                          boxShadow: `0 0 0 1px ${est.color}33`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: est.color }}
                  />
                  {est.nombre}
                </button>
              );
            })}
          </div>
          {estadoCol.obligatoriaAlta && !estadoId ? (
            <p className="m-0 mt-3 text-xs text-amber-700">Seleccioná un estado para continuar.</p>
          ) : null}
        </FormSection>
      )}

      {ubicacionCol && (
        <FormSection
          icon={<MapPin size={15} />}
          title="Ubicación"
          hint="Dónde queda registrado el activo al momento del alta."
        >
          <FieldShell label={ubicacionCol.etiqueta} required={ubicacionCol.obligatoriaAlta}>
            <StyledSelect
              value={ubicacionId}
              disabled={disabled}
              placeholder="Seleccioná una ubicación…"
              options={ubicacionesActivas.map((u) => ({
                value: u.id,
                label: u.descripcion ? `${u.nombre} — ${u.descripcion}` : u.nombre,
              }))}
              onChange={onUbicacionId}
            />
            {selectedUbicacion?.descripcion ? (
              <p className="m-0 mt-2 text-xs text-slate-500 leading-snug">
                {selectedUbicacion.descripcion}
              </p>
            ) : null}
          </FieldShell>
        </FormSection>
      )}

      {descripcionCol && (
        <FormSection
          icon={<FileText size={15} />}
          title="Descripción"
          hint="Detalle libre para identificar el activo en el inventario."
        >
          <FieldShell label={descripcionCol.etiqueta} required={descripcionCol.obligatoriaAlta}>
            <textarea
              value={fieldValues[descripcionCol.codigo] ?? ''}
              disabled={disabled}
              onChange={(e) => onFieldValue(descripcionCol.codigo, e.target.value)}
              className={`${inputClass} min-h-[88px] resize-y`}
              placeholder="Notas, marca, modelo u observación…"
              rows={3}
            />
          </FieldShell>
        </FormSection>
      )}

      {customFields.length > 0 && (
        <FormSection
          icon={<SlidersHorizontal size={15} />}
          title="Propiedades adicionales"
          hint="Campos personalizados definidos en el catálogo del sistema."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFields.map((col) => {
              const fullWidth = col.tipo === 'lista' || col.tipo === 'texto';
              return (
                <FieldShell
                  key={col.codigo}
                  label={col.etiqueta}
                  required={col.obligatoriaAlta}
                  className={fullWidth ? 'md:col-span-2' : ''}
                >
                  {col.tipo === 'lista' ? (
                    <PropiedadListaField
                      col={col}
                      value={fieldValues[col.codigo] ?? ''}
                      disabled={disabled}
                      onChange={(v) => onFieldValue(col.codigo, v)}
                    />
                  ) : (
                    <input
                      type={
                        col.tipo === 'numero' ? 'number' : col.tipo === 'fecha' ? 'date' : 'text'
                      }
                      value={fieldValues[col.codigo] ?? ''}
                      disabled={disabled}
                      onChange={(e) => onFieldValue(col.codigo, e.target.value)}
                      className={inputClass}
                      placeholder={`Ingresá ${col.etiqueta.toLowerCase()}…`}
                    />
                  )}
                </FieldShell>
              );
            })}
          </div>
        </FormSection>
      )}

      {!skuCol && !estadoCol && !ubicacionCol && !descripcionCol && !codigoInternoCol && customFields.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <Layers3 size={20} className="mx-auto text-slate-300 mb-2" />
          <p className="m-0 text-sm text-slate-500">No hay campos configurados para el alta.</p>
        </div>
      )}
    </div>
  );
}

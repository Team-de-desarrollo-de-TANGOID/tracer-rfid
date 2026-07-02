import { Check } from 'lucide-react';
import StyledSelect from './StyledSelect';
import type { ColumnaTabla } from '../types';
import {
  formatListaValor,
  parseListaOpciones,
  parseListaValor,
} from '../utils/propiedadLista';

interface Props {
  col: ColumnaTabla;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export default function PropiedadListaField({ col, value, disabled = false, onChange }: Props) {
  const opciones = parseListaOpciones(col.listaOpciones);
  const multiple = Boolean(col.listaMultiple);
  const selected = parseListaValor(value, multiple);

  if (opciones.length === 0) {
    return (
      <p className="text-xs text-amber-600 m-0 py-2 px-3 bg-amber-50 rounded-lg border border-amber-100">
        Esta lista no tiene opciones configuradas.
      </p>
    );
  }

  if (!multiple) {
    const selectedId = opciones.findIndex((o) => o === selected[0]) + 1;
    return (
      <StyledSelect
        value={selectedId > 0 ? selectedId : 0}
        disabled={disabled}
        placeholder="Seleccioná una opción…"
        options={opciones.map((o, i) => ({ value: i + 1, label: o }))}
        onChange={(id) => onChange(opciones[id - 1] ?? '')}
      />
    );
  }

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((x) => x !== opt)
      : [...selected, opt];
    onChange(formatListaValor(next, true));
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {opciones.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt)}
            className={`inline-flex items-center gap-1.5 py-2 px-3 border rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              active
                ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {active && <Check size={12} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

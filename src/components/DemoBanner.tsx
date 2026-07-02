import { Radio } from 'lucide-react';

interface Props {
  demo?: boolean;
}

export default function DemoBanner({ demo = true }: Props) {
  if (!demo) {
    return (
      <div className="flex-shrink-0 px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-blue-900 text-xs font-medium">
        <Radio size={14} className="text-blue-600" />
        <span>
          <strong>FX9600 activo</strong> — Puerta en modo real. Lector USB R3 sigue simulado.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-amber-900 text-xs font-medium">
      <Radio size={14} className="text-amber-600 animate-pulse" />
      <span>
        <strong>Modo DEMO</strong> — Lectores R3 y FX9600 simulados. Sin hardware conectado.
      </span>
    </div>
  );
}

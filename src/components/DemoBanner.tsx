import { Radio } from 'lucide-react';

export default function DemoBanner() {
  return (
    <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-amber-900 text-xs font-medium">
      <Radio size={14} className="text-amber-600 animate-pulse" />
      <span>
        <strong>Modo DEMO</strong> — Lectores R3 y FX9600 simulados. Sin hardware conectado.
      </span>
    </div>
  );
}

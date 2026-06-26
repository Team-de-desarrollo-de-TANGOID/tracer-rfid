import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  children: (close: () => void) => ReactNode;
  label?: string;
}

export default function CollapsibleAddForm({ children, label = 'Agregar' }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
      >
        <Plus size={14} />
        {label}
      </button>
    );
  }

  return (
    <div className="border border-blue-100 bg-blue-50/40 rounded-lg p-4 space-y-3">
      {children(close)}
      <button
        type="button"
        onClick={close}
        className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
      >
        Cancelar
      </button>
    </div>
  );
}

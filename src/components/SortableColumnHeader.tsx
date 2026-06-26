import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDir } from '../utils/tableSort';

interface Props {
  label: string;
  columnKey: string;
  sortColumn: string | null;
  sortDir: SortDir;
  onSort: (columnKey: string) => void;
  className?: string;
}

export default function SortableColumnHeader({
  label,
  columnKey,
  sortColumn,
  sortDir,
  onSort,
  className = '',
}: Props) {
  const active = sortColumn === columnKey;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      className={`px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0] ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 max-w-full cursor-pointer select-none rounded px-1 -mx-1 py-0.5 transition-colors ${
          active ? 'text-blue-700' : 'hover:text-slate-800'
        }`}
        title={active ? `Ordenado ${sortDir === 'asc' ? 'A→Z' : 'Z→A'}` : 'Ordenar columna'}
      >
        <span className="truncate">{label}</span>
        <Icon size={12} className={`shrink-0 ${active ? 'text-blue-600' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

export function useColumnSortState() {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (codigo: string) => {
    if (sortColumn === codigo) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(codigo);
      setSortDir('asc');
    }
  };

  return { sortColumn, sortDir, toggleSort };
}

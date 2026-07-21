import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export function CascadeColumn({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav
      className={`flex flex-col min-h-0 bg-white shrink-0 overflow-y-auto border-r border-slate-100 ${className}`}
      aria-label={title}
    >
      <div className="px-2.5 py-2 border-b border-slate-100 shrink-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 m-0">{title}</p>
      </div>
      <div className="flex flex-col py-1 px-1 gap-px">{children}</div>
    </nav>
  );
}

export function CascadeItem({
  title,
  subtitle,
  selected,
  disabled,
  onSelect,
  hasChildren,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  hasChildren?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-current={selected ? 'page' : undefined}
      className={`group w-full flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-md text-left transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
        selected
          ? 'bg-slate-100/90 text-slate-900'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <span
        aria-hidden
        className={`w-0.5 self-stretch rounded-full shrink-0 transition-colors ${
          selected ? 'bg-blue-500' : 'bg-transparent group-hover:bg-slate-200'
        }`}
      />
      <div className="flex-1 min-w-0 py-px">
        <span className="block text-[12px] font-medium leading-tight truncate">{title}</span>
        {subtitle && (
          <span className="block text-[10px] leading-tight truncate mt-0.5 text-slate-400">
            {subtitle}
          </span>
        )}
      </div>
      {hasChildren && (
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={`shrink-0 ${selected ? 'text-slate-400' : 'text-slate-300 group-hover:text-slate-400'}`}
        />
      )}
    </button>
  );
}

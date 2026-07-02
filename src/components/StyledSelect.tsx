import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: number;
  label: string;
}

interface Props {
  value: number;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  /** Monoespaciada solo para códigos técnicos (TID, etc.) */
  mono?: boolean;
  onChange: (value: number) => void;
}

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 6;

export default function StyledSelect({
  value,
  options,
  placeholder,
  disabled = false,
  mono = false,
  onChange,
}: Props) {
  const fontClass = mono ? 'font-mono' : 'font-form';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuRect, setMenuRect] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  const updateMenuRect = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      MENU_MAX_HEIGHT,
      Math.max(80, openUp ? spaceAbove : spaceBelow)
    );

    setMenuRect({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + MENU_GAP,
      bottom: openUp ? window.innerHeight - rect.top + MENU_GAP : undefined,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-styled-select-menu]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updateMenuRect();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const hasValue = value > 0 && Boolean(selected);

  const menu =
    open && menuRect
      ? createPortal(
          <ul
            data-styled-select-menu
            role="listbox"
            style={{
              position: 'fixed',
              left: menuRect.left,
              width: menuRect.width,
              top: menuRect.top,
              bottom: menuRect.bottom,
              maxHeight: menuRect.maxHeight,
              zIndex: 9999,
            }}
            className={`overflow-y-auto py-1.5 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-300/30 list-none m-0 p-0 ${fontClass}`}
          >
            {options.length === 0 ? (
              <li className="px-3.5 py-2.5 text-sm text-slate-400 text-center">Sin opciones</li>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm ${fontClass} text-left cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`truncate ${fontClass}`}>{opt.label}</span>
                      {isSelected && <Check size={14} className="shrink-0 text-blue-600" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 py-2.5 px-3.5 border rounded-xl text-sm ${fontClass} bg-white transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'border-blue-400 ring-2 ring-blue-500/25 shadow-sm'
            : hasValue
              ? 'border-slate-200 text-slate-800 hover:border-slate-300'
              : 'border-slate-200 text-slate-400 hover:border-slate-300'
        }`}
      >
        <span className={`truncate ${fontClass}`}>{hasValue ? selected!.label : placeholder}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {menu}
    </div>
  );
};

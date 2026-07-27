import { Minus, Square, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import AppIcon from './AppIcon';
import { APP_NAME } from '../constants/branding';

type WindowApi = {
  isElectron?: boolean;
  vendor?: string;
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
};

function getApi(): WindowApi | undefined {
  return (window as unknown as { racketClub?: WindowApi }).racketClub;
}

/**
 * Barra superior corporativa (solo Electron / ventana sin marco).
 * La zona central es arrastrable; los botones usan no-drag.
 */
export default function ElectronTitleBar() {
  const api = getApi();
  if (!api?.isElectron) return null;

  const btn =
    'h-full w-[46px] flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer border-0 bg-transparent';

  const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

  return (
    <header
      className="h-10 shrink-0 flex items-stretch bg-[#0f172a] text-white border-b border-white/10 select-none"
      style={dragStyle}
    >
      <div className="flex items-center gap-2.5 pl-3.5 pr-4 min-w-0">
        <AppIcon size={22} />
        <div className="min-w-0 leading-tight">
          <div className="text-[12px] font-semibold tracking-wide truncate">{APP_NAME}</div>
          <div className="text-[9px] text-slate-400 tracking-[0.16em] uppercase truncate">
            {api.vendor ?? 'TANGOID SRL'}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-stretch" style={noDragStyle}>
        <button
          type="button"
          aria-label="Minimizar"
          className={btn}
          onClick={() => api.minimize?.()}
        >
          <Minus size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Maximizar"
          className={btn}
          onClick={() => api.maximize?.()}
        >
          <Square size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Cerrar"
          className={`${btn} hover:bg-red-600 hover:text-white`}
          onClick={() => api.close?.()}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

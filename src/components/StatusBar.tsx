import { useEffect, useState } from 'react';
import { Clock, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_NAME, APP_VERSION, COMPANY } from '../constants/branding';
import { formatFechaHora } from '../utils/datetime';

function formatOrDash(value: string | null | undefined): string {
  if (!value) return '—';
  return formatFechaHora(value);
}

export default function StatusBar() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!user) return null;

  const clock = now.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return (
    <footer className="shrink-0 h-8 border-t border-slate-200 bg-slate-100/95 text-[11px] text-slate-600 flex items-center gap-3 px-3 select-none">
      <div className="flex items-center gap-1.5 min-w-0 shrink">
        <UserRound size={12} className="text-slate-400 shrink-0" />
        <span className="truncate font-medium text-slate-700">{user.nombre}</span>
        <span className="text-slate-300">·</span>
        <span className="truncate text-slate-500">{user.rolNombre}</span>
      </div>

      <span className="text-slate-300 hidden sm:inline">|</span>

      <div className="hidden sm:flex items-center gap-1.5 min-w-0">
        <span className="text-slate-400 shrink-0">Sesión:</span>
        <span className="truncate tabular-nums">{formatOrDash(user.ultimoLogin)}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 min-w-0">
        <span className="text-slate-400 shrink-0">Último acceso:</span>
        <span className="truncate tabular-nums">{formatOrDash(user.loginAnterior)}</span>
      </div>

      <div className="flex-1" />

      <div className="hidden lg:flex items-center gap-1.5 text-slate-500 shrink-0">
        <span>{APP_NAME}</span>
        <span className="text-slate-300">·</span>
        <span className="font-mono">v{APP_VERSION}</span>
        <span className="text-slate-300">·</span>
        <span>{COMPANY.legalName}</span>
      </div>

      <div className="flex items-center gap-1 text-slate-500 shrink-0 tabular-nums">
        <Clock size={11} className="text-slate-400" />
        {clock}
      </div>
    </footer>
  );
}

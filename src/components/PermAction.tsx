import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissionCatalog } from '../context/PermissionCatalogContext';

type PermCheck = string | string[];

function codesOf(permission: PermCheck): string[] {
  return Array.isArray(permission) ? permission : [permission];
}

function usePermAllowed(permission: PermCheck, requireAll = false) {
  const { hasPermission } = useAuth();
  const list = codesOf(permission);
  const allowed = requireAll
    ? list.every((c) => hasPermission(c))
    : list.some((c) => hasPermission(c));
  return { allowed, list };
}

export interface PermActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  permission: PermCheck;
  requireAll?: boolean;
  children: ReactNode;
  lockedClassName?: string;
}

/** Botón siempre visible; bloqueado con candado si falta permiso. */
export function PermAction({
  permission,
  requireAll = false,
  children,
  className = '',
  lockedClassName = '',
  disabled,
  onClick,
  title,
  type = 'button',
  ...rest
}: PermActionProps) {
  const { getPermissionName } = usePermissionCatalog();
  const { allowed, list } = usePermAllowed(permission, requireAll);

  const lockTitle = list
    .map((c) => `${getPermissionName(c)} (${c})`)
    .join(requireAll ? ' y ' : ' o ');

  if (!allowed) {
    return (
      <span className="inline-flex relative group">
        <button
          type={type}
          disabled
          title={title ?? `Requiere permiso: ${lockTitle}`}
          className={`inline-flex items-center gap-1.5 opacity-55 cursor-not-allowed ${className} ${lockedClassName}`.trim()}
          {...rest}
        >
          <Lock size={13} className="shrink-0 text-slate-500" aria-hidden />
          {children}
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 hidden group-hover:block w-max max-w-[240px] px-2 py-1 rounded-md bg-slate-900 text-white text-[10px] leading-snug shadow-lg"
        >
          Requiere: {lockTitle}
        </span>
      </span>
    );
  }

  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Envuelve cualquier control; muestra candado si no hay permiso. */
export function PermGate({
  permission,
  requireAll = false,
  children,
  fallback,
}: {
  permission: PermCheck;
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { getPermissionName } = usePermissionCatalog();
  const { allowed, list } = usePermAllowed(permission, requireAll);

  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const lockTitle = list.map((c) => `${getPermissionName(c)} (${c})`).join(', ');

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-slate-400"
      title={`Requiere: ${lockTitle}`}
    >
      <Lock size={12} aria-hidden />
      <span className="sr-only">Bloqueado: {lockTitle}</span>
    </span>
  );
}

export function usePerm(permission: PermCheck, requireAll = false) {
  const { hasPermission } = useAuth();
  const { getPermissionName } = usePermissionCatalog();
  const list = codesOf(permission);
  const allowed = requireAll
    ? list.every((c) => hasPermission(c))
    : list.some((c) => hasPermission(c));
  return { allowed, codes: list, getPermissionName };
}

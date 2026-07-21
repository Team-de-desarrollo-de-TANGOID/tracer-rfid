import type { ActivosSection, ConfigSection, SidebarTab } from '../types';
import { ACTIVOS_SECTIONS, CONFIG_SECTIONS } from '../types';

export const APP_PATHS = {
  dashboard: '/',
  activosInventario: '/activos/inventario',
  activosAgregar: '/activos/agregar',
  sincronizar: '/sincronizar',
  config: (section: ConfigSection = 'catalogos') => `/configuracion/${section}`,
} as const;

const CONFIG_SECTION_IDS = new Set(CONFIG_SECTIONS.map((s) => s.id));
const ACTIVOS_SECTION_IDS = new Set(ACTIVOS_SECTIONS.map((s) => s.id));

export function isConfigSection(value: string | undefined): value is ConfigSection {
  return Boolean(value && CONFIG_SECTION_IDS.has(value as ConfigSection));
}

export function isActivosSection(value: string | undefined): value is ActivosSection {
  return Boolean(value && ACTIVOS_SECTION_IDS.has(value as ActivosSection));
}

export interface ParsedAppPath {
  tab: SidebarTab | null;
  activosSection?: ActivosSection;
  configSection?: ConfigSection;
}

export function parseAppPath(pathname: string): ParsedAppPath {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  if (segments.length === 0) return { tab: 'dashboard' };

  if (segments[0] === 'activos') {
    if (segments[1] === 'agregar') return { tab: 'activos', activosSection: 'agregar' };
    if (!segments[1] || segments[1] === 'inventario') {
      return { tab: 'activos', activosSection: 'inventario' };
    }
    return { tab: null };
  }

  if (segments[0] === 'configuracion') {
    if (!segments[1]) return { tab: 'configuracion', configSection: 'catalogos' };
    if (!isConfigSection(segments[1])) return { tab: null };
    return { tab: 'configuracion', configSection: segments[1] };
  }

  if (segments[0] === 'dashboard') return { tab: 'dashboard' };
  if (segments[0] === 'sincronizar') return { tab: 'sincronizar' };

  return { tab: null };
}

export function pathForActivosSection(section: ActivosSection): string {
  return section === 'agregar' ? APP_PATHS.activosAgregar : APP_PATHS.activosInventario;
}

export function pathForTab(
  tab: SidebarTab,
  sub?: ActivosSection | ConfigSection
): string {
  switch (tab) {
    case 'dashboard':
      return APP_PATHS.dashboard;
    case 'activos':
      return pathForActivosSection(sub === 'agregar' ? 'agregar' : 'inventario');
    case 'sincronizar':
      return APP_PATHS.sincronizar;
    case 'configuracion':
      return APP_PATHS.config(isConfigSection(sub) ? sub : 'catalogos');
  }
}

export function getDefaultAppPath(
  canAccessTab: (tab: SidebarTab) => boolean,
  canAccessActivosSection: (section: ActivosSection) => boolean,
  canAccessConfigSection: (section: ConfigSection) => boolean
): string {
  const tabOrder: SidebarTab[] = ['dashboard', 'activos', 'sincronizar', 'configuracion'];

  for (const tab of tabOrder) {
    if (!canAccessTab(tab)) continue;

    if (tab === 'activos') {
      const section = ACTIVOS_SECTIONS.find((s) => canAccessActivosSection(s.id));
      if (section) return pathForActivosSection(section.id);
      continue;
    }

    if (tab === 'configuracion') {
      const section = CONFIG_SECTIONS.find((s) => canAccessConfigSection(s.id));
      if (section) return APP_PATHS.config(section.id);
      continue;
    }

    return pathForTab(tab);
  }

  return APP_PATHS.dashboard;
}

export function isPathAllowed(
  pathname: string,
  canAccessTab: (tab: SidebarTab) => boolean,
  canAccessActivosSection: (section: ActivosSection) => boolean,
  canAccessConfigSection: (section: ConfigSection) => boolean
): boolean {
  const parsed = parseAppPath(pathname);
  if (!parsed.tab || !canAccessTab(parsed.tab)) return false;

  if (parsed.tab === 'activos') {
    const section = parsed.activosSection ?? 'inventario';
    return canAccessActivosSection(section);
  }

  if (parsed.tab === 'configuracion') {
    const section = parsed.configSection ?? 'catalogos';
    return canAccessConfigSection(section);
  }

  return true;
}

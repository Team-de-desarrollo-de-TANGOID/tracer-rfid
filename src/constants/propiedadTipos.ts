import { Type, Hash, Calendar, List, type LucideIcon } from 'lucide-react';
import type { TipoPropiedad } from '../types';

export interface TipoPropiedadMeta {
  id: TipoPropiedad;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const TIPOS_PROPIEDAD: TipoPropiedadMeta[] = [
  {
    id: 'texto',
    label: 'Texto',
    description: 'Texto libre para notas, nombres o referencias.',
    icon: Type,
  },
  {
    id: 'numero',
    label: 'Número',
    description: 'Solo valores numéricos (cantidad, medida, etc.).',
    icon: Hash,
  },
  {
    id: 'fecha',
    label: 'Fecha',
    description: 'Selector de fecha del calendario.',
    icon: Calendar,
  },
  {
    id: 'lista',
    label: 'Lista',
    description: 'Opciones predefinidas; el usuario elige una o varias.',
    icon: List,
  },
];

export function getTipoPropiedadMeta(tipo?: TipoPropiedad): TipoPropiedadMeta {
  return TIPOS_PROPIEDAD.find((t) => t.id === tipo) ?? TIPOS_PROPIEDAD[0];
}

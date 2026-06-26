import { useCallback, useState } from 'react';
import type { Activo, ColumnaTabla, Estado, Ubicacion } from '../types';
import {
  activoPermiteEditarMotivoBaja,
  canEditColumnInQuickMode,
  estadoRequiereMotivoBaja,
} from '../utils/activoEdit';

export interface EditingField {
  id: number;
  field: string;
  value: string;
}

export interface AwaitingMotivoBaja {
  activoId: number;
  estadoId: number;
  motivo: string;
}

interface Options {
  estados: Estado[];
  ubicaciones: Ubicacion[];
  canEdit: boolean;
  canChangeEstado: boolean;
  canQuickEdit: boolean;
  onUpdateActivo: (
    id: number,
    body: Partial<{
      descripcion: string;
      ubicacionId: number;
      codigoInterno: string;
      motivoBaja: string;
      propiedadesExtra: Record<string, string>;
    }>
  ) => Promise<void>;
  onUpdateEstado: (id: number, estadoId: number, motivoBaja?: string) => Promise<void>;
}

export function useActivoInlineEdit({
  estados,
  ubicaciones,
  canEdit,
  canChangeEstado,
  canQuickEdit,
  onUpdateActivo,
  onUpdateEstado,
}: Options) {
  const [quickEditRowId, setQuickEditRowId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [awaitingMotivo, setAwaitingMotivo] = useState<AwaitingMotivoBaja | null>(null);

  const toggleQuickEdit = useCallback(
    (id: number) => {
      if (!canQuickEdit) return;
      setQuickEditRowId((prev) => {
        if (prev === id) {
          setEditing(null);
          setAwaitingMotivo(null);
          return null;
        }
        setEditing(null);
        setAwaitingMotivo(null);
        return id;
      });
    },
    [canQuickEdit]
  );

  const isQuickEditRow = useCallback(
    (itemId: number) => quickEditRowId === itemId,
    [quickEditRowId]
  );

  const canEditCol = useCallback(
    (col: ColumnaTabla, item: Activo) =>
      canEditColumnInQuickMode(col, item, {
        canEdit,
        canChangeEstado,
        isQuickEditRow: isQuickEditRow(item.id),
      }),
    [canEdit, canChangeEstado, isQuickEditRow]
  );

  const startFieldEdit = useCallback(
    (id: number, field: string, value: string, col: ColumnaTabla, item: Activo) => {
      if (!canEditCol(col, item)) return;
      setEditing({ id, field, value });
    },
    [canEditCol]
  );

  const commitFieldEdit = useCallback(
    async (item: Activo, col?: ColumnaTabla) => {
      if (!editing || editing.id !== item.id) return;
      const { field, value } = editing;
      setEditing(null);

      if (field === 'ubicacion') {
        const ub = ubicaciones.find((u) => u.nombre === value);
        if (ub) await onUpdateActivo(item.id, { ubicacionId: ub.id });
      } else if (field === 'descripcion') {
        await onUpdateActivo(item.id, { descripcion: value });
      } else if (field === 'codigo_interno') {
        await onUpdateActivo(item.id, { codigoInterno: value });
      } else if (field === 'motivo_baja' && activoPermiteEditarMotivoBaja(item)) {
        await onUpdateActivo(item.id, { motivoBaja: value });
      } else if (col?.esCustom) {
        await onUpdateActivo(item.id, { propiedadesExtra: { [field]: value } });
      }
    },
    [editing, ubicaciones, onUpdateActivo]
  );

  const handleEstadoChange = useCallback(
    async (item: Activo, estadoId: number) => {
      const nuevoEstado = estados.find((e) => e.id === estadoId);
      if (!nuevoEstado) return;

      if (estadoRequiereMotivoBaja(nuevoEstado) && estadoId !== item.estadoId) {
        setAwaitingMotivo({ activoId: item.id, estadoId, motivo: '' });
        return;
      }

      setAwaitingMotivo(null);
      await onUpdateEstado(item.id, estadoId);
    },
    [estados, onUpdateEstado]
  );

  const confirmMotivoBaja = useCallback(async () => {
    if (!awaitingMotivo) return;
    await onUpdateEstado(
      awaitingMotivo.activoId,
      awaitingMotivo.estadoId,
      awaitingMotivo.motivo.trim() || undefined
    );
    setAwaitingMotivo(null);
    setQuickEditRowId(null);
  }, [awaitingMotivo, onUpdateEstado]);

  const cancelMotivoBaja = useCallback(() => {
    setAwaitingMotivo(null);
  }, []);

  const confirmQuickEdit = useCallback((id: number) => {
    if (quickEditRowId !== id) return;
    setEditing(null);
    setAwaitingMotivo(null);
    setQuickEditRowId(null);
  }, [quickEditRowId]);

  return {
    quickEditRowId,
    toggleQuickEdit,
    confirmQuickEdit,
    isQuickEditRow,
    canEditCol,
    editing,
    setEditing,
    startFieldEdit,
    commitFieldEdit,
    handleEstadoChange,
    awaitingMotivo,
    setAwaitingMotivo,
    confirmMotivoBaja,
    cancelMotivoBaja,
  };
}

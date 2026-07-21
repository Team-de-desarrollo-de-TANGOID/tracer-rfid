import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useBlocker } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export interface UnsavedChangesGuard {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
  title?: string;
}

interface UnsavedChangesContextValue {
  registerGuard: (guard: UnsavedChangesGuard | null) => void;
  requestLeave: (proceed: () => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    return {
      registerGuard: () => {},
      requestLeave: (proceed: () => void) => proceed(),
    };
  }
  return ctx;
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<UnsavedChangesGuard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);

  const registerGuard = useCallback((guard: UnsavedChangesGuard | null) => {
    guardRef.current = guard;
  }, []);

  const openDialog = useCallback((proceed: () => void) => {
    setPendingProceed(() => proceed);
    setDialogOpen(true);
  }, []);

  const requestLeave = useCallback(
    (proceed: () => void) => {
      if (!guardRef.current?.isDirty()) {
        proceed();
        return;
      }
      openDialog(proceed);
    },
    [openDialog]
  );

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!guardRef.current?.isDirty()) return false;
    return (
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search ||
      currentLocation.hash !== nextLocation.hash
    );
  });

  useEffect(() => {
    if (blocker.state !== 'blocked' || dialogOpen) return;
    openDialog(() => blocker.proceed());
  }, [blocker.state, dialogOpen, blocker, openDialog]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!guardRef.current?.isDirty()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setPendingProceed(null);
    setSaving(false);
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  const finishLeave = useCallback(() => {
    const proceed = pendingProceed;
    setDialogOpen(false);
    setPendingProceed(null);
    setSaving(false);
    proceed?.();
  }, [pendingProceed]);

  const handleDiscard = () => {
    guardRef.current?.discard();
    finishLeave();
  };

  const handleSaveAndLeave = async () => {
    if (!guardRef.current) return;
    setSaving(true);
    try {
      const ok = await guardRef.current.save();
      if (ok) finishLeave();
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle = guardRef.current?.title ?? 'Cambios sin guardar';

  return (
    <UnsavedChangesContext.Provider value={{ registerGuard, requestLeave }}>
      {children}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-changes-title"
            className="w-full max-w-sm bg-white rounded-lg shadow-lg border border-slate-200/80 p-4"
          >
            <h2 id="unsaved-changes-title" className="text-sm font-semibold text-slate-900 m-0">
              {dialogTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 mb-4 m-0 leading-relaxed">
              Hay cambios sin guardar. ¿Qué desea hacer antes de salir?
            </p>
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                disabled={saving}
                onClick={closeDialog}
                className="px-2 py-1 text-[11px] font-medium text-slate-500 rounded hover:text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDiscard}
                className="px-2 py-1 text-[11px] font-medium text-red-600 rounded hover:bg-red-50 cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAndLeave}
                className="inline-flex items-center justify-center gap-1 ml-1 px-2.5 py-1 text-[11px] font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : null}
                Guardar y salir
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}

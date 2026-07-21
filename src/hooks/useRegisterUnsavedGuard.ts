import { useEffect } from 'react';
import { useUnsavedChanges, type UnsavedChangesGuard } from '../context/UnsavedChangesContext';

export function useRegisterUnsavedGuard(guard: UnsavedChangesGuard | null) {
  const { registerGuard } = useUnsavedChanges();

  useEffect(() => {
    registerGuard(guard);
    return () => registerGuard(null);
  }, [guard, registerGuard]);
}

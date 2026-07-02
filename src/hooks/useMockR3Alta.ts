import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rc_mock_r3_alta';

function readStored(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function useMockR3Alta() {
  const [enabled, setEnabled] = useState(readStored);

  const setMockEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  }, []);

  return { mockEnabled: enabled, setMockEnabled };
}

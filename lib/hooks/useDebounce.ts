import { useEffect, useState } from 'react';

/**
 * Hook personnalisé pour débouncer une valeur.
 * @param value La valeur à débouncer.
 * @param delay Délai en millisecondes (défaut: 300ms).
 * @returns La valeur débouncée.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
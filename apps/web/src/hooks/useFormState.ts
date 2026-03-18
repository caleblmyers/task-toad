import { useState, useCallback } from 'react';

interface UseFormStateOptions {
  onSuccess?: () => void;
  resetOnSuccess?: boolean;
}

interface UseFormStateReturn<T extends Record<string, unknown>> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  setValue: <K extends keyof T>(key: K, value: T[K]) => void;
  error: string | null;
  setError: (error: string | null) => void;
  loading: boolean;
  success: boolean;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: () => void;
}

export function useFormState<T extends Record<string, unknown>>(
  initialValues: T,
  submitFn: (values: T) => Promise<void>,
  options?: UseFormStateOptions
): UseFormStateReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setError(null);
    setSuccess(false);
    setLoading(false);
  }, [initialValues]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await submitFn(values);
      setSuccess(true);
      if (options?.resetOnSuccess) {
        setValues(initialValues);
      }
      options?.onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [submitFn, values, initialValues, options]);

  return { values, setValues, setValue, error, setError, loading, success, handleSubmit, reset };
}

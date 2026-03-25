import { useState, useCallback } from 'react';

export function useEditableField(initialValue: string, onSave: (value: string) => Promise<void>) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');

  const startEdit = useCallback(() => {
    setValue(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const save = useCallback(async () => {
    await onSave(value);
    setIsEditing(false);
  }, [value, onSave]);

  const cancel = useCallback(() => setIsEditing(false), []);

  return { isEditing, value, setValue, startEdit, save, cancel };
}

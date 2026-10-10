import { usePreferences } from '@payloadcms/ui';
import { useEffect, useRef, useState } from 'react';

// A value remembered per user in Payload's preferences. The stored value
// loads after mount and is dropped if the user already changed the value.
export function useRemembered<T>(
  key: string,
  initial: T,
  valid: (value: unknown) => value is T
): [T, (value: T) => void] {
  const { getPreference, setPreference } = usePreferences();
  const [value, setValue] = useState(initial);
  const changed = useRef(false);
  useEffect(() => {
    let active = true;
    void getPreference<unknown>(`gt-payload:${key}`).then((stored) => {
      if (active && !changed.current && valid(stored)) setValue(stored);
    });
    return () => {
      active = false;
    };
  }, [getPreference, key, valid]);
  return [
    value,
    (next) => {
      changed.current = true;
      setValue(next);
      void setPreference(`gt-payload:${key}`, next);
    },
  ];
}

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

export const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

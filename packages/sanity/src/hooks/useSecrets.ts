// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { useState, useEffect } from 'react';
import { SanityDocumentLike } from 'sanity';
import { useClient } from './useClient';

interface ReturnProps<T> {
  loading: boolean;
  secrets: T | null;
}
export function useSecrets<T>(id: string): ReturnProps<T> {
  const [loading, setLoading] = useState<boolean>(true);
  const [secrets, setSecrets] = useState<T | null>(null);
  const client = useClient();

  useEffect(() => {
    function fetchData() {
      client
        .fetch('* [_id == $id][0]', { id })
        .then((doc: SanityDocumentLike) => {
          const result: Record<string, any> = {};
          for (const key in doc) {
            if (key[0] !== '_') {
              result[key] = doc[key];
            }
          }
          setSecrets(result as T);
          setLoading(false);
        });
    }
    fetchData();
  }, [id, client]);

  return { loading, secrets };
}

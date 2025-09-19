import { SanityClient, useClient as useSanityClient } from 'sanity';

export const useClient = (): SanityClient => {
  return useSanityClient({ apiVersion: '2025-09-15' });
};

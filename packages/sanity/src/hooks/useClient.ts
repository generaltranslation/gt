import { SanityClient, useClient as useSanityClient } from 'sanity';

export const useClient = (): SanityClient => {
  return useSanityClient({ apiVersion: '2022-12-07' });
};

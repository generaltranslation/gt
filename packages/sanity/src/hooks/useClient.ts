// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, useClient as useSanityClient } from 'sanity';

export const useClient = (): SanityClient => {
  return useSanityClient({ apiVersion: '2025-09-15' });
};

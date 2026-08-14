// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, useClient as useSanityClient } from 'sanity';
import { SANITY_API_VERSION } from '../utils/shared';

export const useClient = (): SanityClient => {
  return useSanityClient({ apiVersion: SANITY_API_VERSION });
};

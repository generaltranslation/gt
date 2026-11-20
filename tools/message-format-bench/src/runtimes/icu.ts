import { formatIcu } from '@generaltranslation/icu/parser';
import type { Runtime } from '../values.ts';

const options = { timeZone: 'UTC' };

/** gt returns plain text as it is and parses any other string on every call; it keeps no parsed-message cache. */
export const make: Runtime['make'] =
  (catalog: Record<string, string>) => (key, values) =>
    formatIcu(catalog[key]!, 'en', values, options);

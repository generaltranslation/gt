import { formatMessageTree, type MessageTree } from '@generaltranslation/icu';
import type { Runtime } from '../values.ts';

const options = { formats: {}, timeZone: 'UTC' };

export const make: Runtime['make'] =
  (catalog: Record<string, MessageTree>) => (key, values) =>
    formatMessageTree(catalog[key]!, 'en', values, options);

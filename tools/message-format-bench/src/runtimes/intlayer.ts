import { getDictionary } from '@intlayer/core/interpreter';
import {
  createMessageResolver,
  icuToIntlayerFormatter,
} from '@intlayer/core/messageFormat';
import type { Runtime } from '../values.ts';

type Dictionary = Parameters<typeof getDictionary>[0];

/**
 * What `formatMessage` of Intlayer's react-intl adapter does, without React:
 * the dictionary is interpreted once for the locale, and each message is
 * resolved by the ICU-bound resolver. build.ts asserts this prints what
 * `createIntl().formatMessage()` of `@intlayer/react-intl` prints.
 */
const resolve = createMessageResolver(icuToIntlayerFormatter);

export const make: Runtime['make'] = (dictionary: Dictionary) => {
  const content = getDictionary(dictionary, 'en') as Record<string, unknown>;
  return (key, values) => resolve(content[key], values, 'en');
};

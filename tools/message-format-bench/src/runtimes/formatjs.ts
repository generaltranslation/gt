import { createFormatters, createIntlCache } from '@formatjs/intl';
import { IntlMessageFormat } from 'intl-messageformat';
import type { Runtime } from '../values.ts';

type Message = ConstructorParameters<typeof IntlMessageFormat>[0];

/** As react-intl runs it: one shared Intl formatter cache, one message object per key. */
export const make: Runtime['make'] = (catalog: Record<string, Message>) => {
  const { getNumberFormat, getDateTimeFormat, getPluralRules } =
    createFormatters(createIntlCache());
  const options = {
    formatters: { getNumberFormat, getDateTimeFormat, getPluralRules },
  };
  const cache = new Map<string, IntlMessageFormat>();
  return (key, values) => {
    let message = cache.get(key);
    if (!message) {
      message = new IntlMessageFormat(catalog[key]!, 'en', undefined, options);
      cache.set(key, message);
    }
    return message.format(values) as string;
  };
};

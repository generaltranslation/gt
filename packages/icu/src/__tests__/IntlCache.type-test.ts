// Type-level tests for the Intl cache, checked by `tsc --noEmit` (not run by
// vitest).
import { intlCache } from '../cache/IntlCache';

// A date formatter is shared by its arguments, so they hold its time zone.
intlCache.get('DateTimeFormat', 'en', { dateStyle: 'short', timeZone: 'UTC' });
// @ts-expect-error a shared date formatter needs a time zone
intlCache.get('DateTimeFormat', 'en', { dateStyle: 'short' });
// @ts-expect-error a shared date formatter needs a time zone
intlCache.get('DateTimeFormat', 'en');
// Other constructors take their options as they are.
intlCache.get('NumberFormat', 'en');
intlCache.get('PluralRules', 'en', { type: 'ordinal' });

// Type-level tests for what a caller of `generaltranslation` may leave out,
// checked by `tsc --noEmit` (not run by vitest).
import {
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessage,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
  LocaleConfig,
} from '../index';

declare const date: Date;

// `@generaltranslation/format` requires every argument; here none of the
// ones it resolves is.
formatNum(1);
formatCurrency(1, 'USD');
formatDateTime(date);
formatList(['a', 'b']);
formatListToParts([1, 2]);
formatRelativeTime(-1, 'day');
formatRelativeTimeFromDate(date);
formatCutoff('text');
formatMessage('Hi');

// The same holds for a locale config and its methods.
const config = new LocaleConfig();
config.formatNum(1);
config.formatDateTime(date);
config.formatMessage('Hi');
config.formatRelativeTimeFromDate(date);
config.formatRelativeTimeFromDate(date, 'en', {});
config.formatRelativeTimeFromDate(date, 'en', { baseDate: date });

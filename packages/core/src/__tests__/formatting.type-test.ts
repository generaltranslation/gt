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
  GTIntl,
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

// The same holds for a GTIntl and its methods.
const intl = new GTIntl();
intl.formatNum(1);
intl.formatDateTime(date);
intl.formatMessage('Hi');
intl.formatRelativeTimeFromDate(date);
intl.formatRelativeTimeFromDate(date, { locale: 'en' });
intl.formatRelativeTimeFromDate(date, { locale: 'en', baseDate: date });

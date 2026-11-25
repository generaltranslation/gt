// Type-level tests for what a caller of `generaltranslation` may leave out,
// checked by `tsc --noEmit` (not run by vitest).
import {
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatIcu,
  formatList,
  formatListToParts,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
  GTIntl,
} from '../index';
import { formatMessageTree } from '../internal';
import type { MessageTree } from '@generaltranslation/icu';

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
formatIcu('Hi');

// The same holds for a GTIntl and its methods.
const intl = new GTIntl();
intl.formatNum(1);
intl.formatDateTime(date);
intl.formatIcu('Hi');
intl.formatRelativeTimeFromDate(date);
intl.formatRelativeTimeFromDate(date, { locale: 'en' });
intl.formatRelativeTimeFromDate(date, { locale: 'en', baseDate: date });

// The currency and the currency style come from the arguments, not options.
// @ts-expect-error
formatCurrency(1, 'USD', { currency: 'EUR' });
// @ts-expect-error
formatCurrency(1, 'USD', { style: 'percent' });
// @ts-expect-error
intl.formatCurrency(1, 'USD', { currency: 'EUR' });
// @ts-expect-error
intl.formatCurrency(1, 'USD', { style: 'percent' });

// A message tree formats to a string from plain values. Other values give
// `unknown`: a function is returned as it is where the tree has a plain
// placeholder and called where it has a tag, and the types cannot see which.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function expectType<T extends true>(): void {}

declare const tree: MessageTree;
type Element = { readonly type: string };
declare const element: Element;
declare const captured: Record<string, unknown>;
declare const id: bigint;
const joinParts = (parts: string[]) => parts.join('');

const plain = formatMessageTree(tree, { values: { name: 'Ada', id } });
expectType<Equal<typeof plain, string>>();
const none = formatMessageTree(tree);
expectType<Equal<typeof none, string>>();
const rich = formatMessageTree(tree, { values: { avatar: element } });
expectType<Equal<typeof rich, unknown>>();
const tagged = formatMessageTree(tree, { values: { b: joinParts } });
expectType<Equal<typeof tagged, unknown>>();
// Tag formatters of different types need no type argument.
formatMessageTree(tree, { values: { b: joinParts, image: () => element } });
// Values of an unknown type, as a tagged template captures them.
const any = formatMessageTree(tree, { values: captured });
expectType<Equal<typeof any, unknown>>();

const formats = {};
const plainMethod = intl.formatMessageTree(tree, {
  values: { name: 'Ada' },
  formats,
});
expectType<Equal<typeof plainMethod, string>>();
const richMethod = intl.formatMessageTree(tree, {
  values: { avatar: element },
  formats,
});
expectType<Equal<typeof richMethod, unknown>>();
const taggedMethod = intl.formatMessageTree(tree, {
  values: { b: joinParts },
  formats,
});
expectType<Equal<typeof taggedMethod, unknown>>();
intl.formatMessageTree(tree, {
  values: { b: joinParts, image: () => element },
  formats,
});

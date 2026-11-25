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
formatMessage('Hi');

// The same holds for a GTIntl and its methods.
const intl = new GTIntl();
intl.formatNum(1);
intl.formatDateTime(date);
intl.formatMessage('Hi');
intl.formatRelativeTimeFromDate(date);
intl.formatRelativeTimeFromDate(date, { locale: 'en' });
intl.formatRelativeTimeFromDate(date, { locale: 'en', baseDate: date });

// A message tree formats to what its values make it, as in
// `@generaltranslation/icu`: a string from plain values, the parts around a
// rich value otherwise.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function expectType<T extends true>(): void {}

declare const tree: MessageTree;
type Element = { readonly type: string };
declare const element: Element;
type Rich = string | Element | Array<string | Element>;
declare const captured: Record<string, unknown>;
declare const id: bigint;

const plain = formatMessageTree(tree, { values: { name: 'Ada', id } });
expectType<Equal<typeof plain, string>>();
const none = formatMessageTree(tree);
expectType<Equal<typeof none, string>>();
const rich = formatMessageTree(tree, { values: { avatar: element } });
expectType<Equal<typeof rich, Rich>>();
const tagged = formatMessageTree<Element>(tree, {
  values: { b: (parts) => ({ type: 'b', children: parts }) as Element },
});
expectType<Equal<typeof tagged, Rich>>();
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
expectType<Equal<typeof richMethod, Rich>>();
const taggedMethod = intl.formatMessageTree<Element>(tree, {
  values: { b: (parts) => ({ type: 'b', children: parts }) as Element },
  formats,
});
expectType<Equal<typeof taggedMethod, Rich>>();

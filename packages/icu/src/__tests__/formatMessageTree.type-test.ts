// Type-level tests for formatMessageTree and formatMessage, checked by
// `tsc --noEmit` (not run by vitest).
import { formatMessageTree, type MessageTree } from '../index';
import { formatMessage } from '../parser';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function expectType<T extends true>(): void {}

declare const tree: MessageTree;
type Element = { readonly type: string };
declare const element: Element;
declare const id: bigint;

// Plain values, or none, always format to a string.
const plain = formatMessageTree(tree, 'en', {
  count: 2,
  name: 'Ada',
  id,
  admin: true,
  nickname: undefined,
  manager: null,
});
expectType<Equal<typeof plain, string>>();
const none = formatMessageTree(tree);
expectType<Equal<typeof none, string>>();

// A rich value makes the result that value or the parts around it.
type Rich = string | Element | Array<string | Element>;
const rich = formatMessageTree(tree, 'en', { name: 'Ada', avatar: element });
expectType<Equal<typeof rich, Rich>>();

// A tag formatter's parts are typed by R, so R is written or `parts` annotated.
const tagged = formatMessageTree<Element>(tree, 'en', {
  b: (parts) => ({ type: 'b', children: parts }) as Element,
});
expectType<Equal<typeof tagged, Rich>>();
const annotated = formatMessageTree(tree, 'en', {
  b: (parts: unknown[]) => ({ type: 'b', children: parts }) as Element,
});
expectType<Equal<typeof annotated, Rich>>();

// A tag formatter may return several parts; R is one part, not the array.
const several = formatMessageTree(tree, 'en', {
  b: (_parts: unknown[]) => ['(', element, ')'],
});
expectType<Equal<typeof several, Rich>>();
const single = formatMessageTree(tree, 'en', {
  b: (_parts: unknown[]) => [element],
});
expectType<Equal<typeof single, Rich>>();

// A Date is plain: a date node formats it, and elsewhere it is String(date).
const dated = formatMessageTree(tree, 'en', { due: new Date(0) });
expectType<Equal<typeof dated, string>>();

// A Date next to a text-only tag: plain, so still a string.
const textTag = (parts: string[]) => parts.join('');
const treeMixed = formatMessageTree(tree, 'en', {
  due: new Date(0),
  b: textTag,
});
expectType<Equal<typeof treeMixed, string>>();
// @ts-expect-error parts typed string[] next to a rich value
formatMessageTree(tree, 'en', { avatar: element, b: textTag });
const treeUnrelated = formatMessageTree<string | Element>(tree, 'en', {
  avatar: element,
  b: (parts: unknown[]) => parts.join(''),
});
expectType<Equal<typeof treeUnrelated, Rich>>();

// formatMessage formats an ICU string with the same rules and types.
const icuText = formatMessage('{a} {b} {c}', 'en', {
  a: 'Ada',
  b: 2,
  c: false,
  d: null,
  e: undefined,
  f: true,
  g: id,
  h: new Date(0),
});
expectType<Equal<typeof icuText, string>>();
const icuNone = formatMessage('Hi');
expectType<Equal<typeof icuNone, string>>();
const icuRich = formatMessage('<b>hi</b> {avatar}', 'en', { avatar: element });
expectType<Equal<typeof icuRich, Rich>>();
const icuTagged = formatMessage<Element>('<b>hi</b>', 'en', {
  b: (parts) => ({ type: 'b', children: parts }) as Element,
});
expectType<Equal<typeof icuTagged, Rich>>();
const icuMixed = formatMessage('{date, date} <b>deadline</b>', 'en', {
  date: new Date(0),
  b: textTag,
});
expectType<Equal<typeof icuMixed, string>>();
// A tag typed for text next to a rich value is an error: the value could end
// up among its parts. With unknown[] parts, R is written, since TypeScript
// does not join the value's type and the tag's into one union.
// @ts-expect-error parts typed string[] next to a rich value
formatMessage('<b>hi</b> {avatar}', 'en', { avatar: element, b: textTag });
const icuUnrelated = formatMessage<string | Element>(
  '<b>hi</b> {avatar}',
  'en',
  {
    avatar: element,
    b: (parts: unknown[]) => parts.join(''),
  }
);
expectType<Equal<typeof icuUnrelated, Rich>>();

// A returned array is always several parts, so R cannot be an array where
// tags format: `[42]` would reach the outer tag as the number 42.
formatMessageTree<number[]>([['o', 'tag', [['i', 'tag', ['x']]]]], 'en', {
  // @ts-expect-error tags need R to be one part, not an array
  i: () => [42],
  // @ts-expect-error tags need R to be one part, not an array
  o: (parts) => parts,
});
// Array values without tags stay one part each.
const listValue = formatMessageTree<string[]>(tree, 'en', { list: ['a'] });
expectType<
  Equal<typeof listValue, string | string[] | Array<string | string[]>>
>();

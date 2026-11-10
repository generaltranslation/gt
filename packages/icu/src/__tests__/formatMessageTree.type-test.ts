// Type-level tests for formatMessageTree and formatMessage, checked by
// `tsc --noEmit` (not run by vitest).
import {
  formatMessageTree,
  type FormatMessageTreeOptions,
  type MessageTree,
} from '../index';
import { formatMessage } from '../parser';
import type { ParsedTree } from '../tree/messageTree';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function expectType<T extends true>(): void {}

declare const tree: MessageTree;
declare const options: FormatMessageTreeOptions;
type Element = { readonly type: string };
declare const element: Element;
declare const id: bigint;

// Plain values, or none, always format to a string.
const plain = formatMessageTree(
  tree,
  'en',
  {
    count: 2,
    name: 'Ada',
    id,
    admin: true,
    nickname: undefined,
    manager: null,
  },
  options
);
expectType<Equal<typeof plain, string>>();
const none = formatMessageTree(tree, 'en', {}, options);
expectType<Equal<typeof none, string>>();

// A rich value makes the result that value or the parts around it.
type Rich = string | Element | Array<string | Element>;
const rich = formatMessageTree(
  tree,
  'en',
  { name: 'Ada', avatar: element },
  options
);
expectType<Equal<typeof rich, Rich>>();

// A tag formatter's parts are typed by R, so R is written or `parts` annotated.
const tagged = formatMessageTree<Element>(
  tree,
  'en',
  {
    b: (parts) => ({ type: 'b', children: parts }) as Element,
  },
  options
);
expectType<Equal<typeof tagged, Rich>>();
const annotated = formatMessageTree(
  tree,
  'en',
  {
    b: (parts: unknown[]) => ({ type: 'b', children: parts }) as Element,
  },
  options
);
expectType<Equal<typeof annotated, Rich>>();

// A tag formatter may return several parts; R is one part, not the array.
const several = formatMessageTree(
  tree,
  'en',
  {
    b: (_parts: unknown[]) => ['(', element, ')'],
  },
  options
);
expectType<Equal<typeof several, Rich>>();
const single = formatMessageTree(
  tree,
  'en',
  {
    b: (_parts: unknown[]) => [element],
  },
  options
);
expectType<Equal<typeof single, Rich>>();

// A Date is plain: a date node formats it, and elsewhere it is String(date).
const dated = formatMessageTree(tree, 'en', { due: new Date(0) }, options);
expectType<Equal<typeof dated, string>>();

// A Date next to a text-only tag: plain, so still a string.
const textTag = (parts: string[]) => parts.join('');
const treeMixed = formatMessageTree(
  tree,
  'en',
  {
    due: new Date(0),
    b: textTag,
  },
  options
);
expectType<Equal<typeof treeMixed, string>>();
// @ts-expect-error parts typed string[] next to a rich value
formatMessageTree(tree, 'en', { avatar: element, b: textTag }, options);
const treeUnrelated = formatMessageTree<string | Element>(
  tree,
  'en',
  {
    avatar: element,
    b: (parts: unknown[]) => parts.join(''),
  },
  options
);
expectType<Equal<typeof treeUnrelated, Rich>>();

// formatMessage formats an ICU string with the same rules and types.
const icuText = formatMessage(
  '{a} {b} {c}',
  'en',
  {
    a: 'Ada',
    b: 2,
    c: false,
    d: null,
    e: undefined,
    f: true,
    g: id,
    h: new Date(0),
  },
  options
);
expectType<Equal<typeof icuText, string>>();
const icuNone = formatMessage('Hi', 'en', {}, options);
expectType<Equal<typeof icuNone, string>>();
const icuRich = formatMessage(
  '<b>hi</b> {avatar}',
  'en',
  { avatar: element },
  options
);
expectType<Equal<typeof icuRich, Rich>>();
const icuTagged = formatMessage<Element>(
  '<b>hi</b>',
  'en',
  {
    b: (parts) => ({ type: 'b', children: parts }) as Element,
  },
  options
);
expectType<Equal<typeof icuTagged, Rich>>();
const icuMixed = formatMessage(
  '{date, date} <b>deadline</b>',
  'en',
  {
    date: new Date(0),
    b: textTag,
  },
  options
);
expectType<Equal<typeof icuMixed, string>>();
// A tag typed for text next to a rich value is an error: the value could end
// up among its parts. With unknown[] parts, R is written, since TypeScript
// does not join the value's type and the tag's into one union.
formatMessage(
  '<b>hi</b> {avatar}',
  'en',
  // @ts-expect-error parts typed string[] next to a rich value
  { avatar: element, b: textTag },
  options
);
const icuUnrelated = formatMessage<string | Element>(
  '<b>hi</b> {avatar}',
  'en',
  {
    avatar: element,
    b: (parts: unknown[]) => parts.join(''),
  },
  options
);
expectType<Equal<typeof icuUnrelated, Rich>>();

// A returned array is always several parts, so R cannot be an array where
// tags format: `[42]` would reach the outer tag as the number 42.
formatMessageTree<number[]>(
  [['o', 'tag', [['i', 'tag', 'x']]]],
  'en',
  {
    // @ts-expect-error tags need R to be one part, not an array
    i: () => [42],
    // @ts-expect-error tags need R to be one part, not an array
    o: (parts) => parts,
  },
  options
);
// The same holds for an array member of a union R.
formatMessage<string | number[]>(
  '<o><i>x</i></o>',
  'en',
  {
    // @ts-expect-error tags need every member of R to be one part
    i: () => [42],
    // @ts-expect-error tags need every member of R to be one part
    o: (parts) => parts,
  },
  options
);
// Array values without tags stay one part each.
const listValue = formatMessageTree<string[]>(
  tree,
  'en',
  { list: ['a'] },
  options
);
expectType<
  Equal<typeof listValue, string | string[] | Array<string | string[]>>
>();

// Every argument is passed in: this package has no defaults of its own and
// does not read the host's time zone.
// @ts-expect-error a message is formatted with a time zone
formatMessageTree(tree, 'en', {});
// @ts-expect-error a message is formatted with a time zone
formatMessage('Hi {name}', 'en', { name: 'Ada' });
// @ts-expect-error a message is formatted in the locales it is given
formatMessageTree(tree, undefined, {}, options);
// @ts-expect-error a message is formatted with the values it is given
formatMessage('Hi', 'en', undefined, options);

// An ICU string's syntax tree holds styles a message tree does not, so the
// formatter reads both and nothing else takes one for a message tree.
declare const parsedTree: ParsedTree;
declare function readMessageTree(tree: MessageTree): void;
declare function readParsedTree(tree: ParsedTree): void;
readParsedTree(tree);
// @ts-expect-error a formatting tree is not a message tree
readMessageTree(parsedTree);

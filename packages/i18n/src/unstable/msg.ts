import { isMessageTree, type MessageTree } from '@generaltranslation/icu';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { buildMessage } from './buildMessage';
import { isTemplateStringsArray, type GTOptions } from './gt';
import type { CheckHoles } from './placeholders';
import { hashMessageTree, type MessageTreeMetadata } from './renderMessage';

/**
 * A message from msg() with values or options, rendered later by m(). Values
 * stay as they were captured, and it is a plain object, so a server component
 * can pass it to a client component.
 */
export type Msg = MessageTreeHashMetadata & {
  tree: MessageTree;
  values: Record<string, unknown>;
  $_hash: string;
};

type MsgTag = <const H extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...holes: CheckHoles<H>
) => string | Msg;

/**
 * Registers a message to translate later with `m`. A string, or a template
 * without values or options, is returned as the string, which is literal
 * text. Any other template is returned as a Msg with its captured values.
 *
 * @example
 * const label = msg('Save');
 * const greeting = msg`Hello, ${{ name }}!`;
 * const button = msg({ context: 'button' })`Save`;
 * m(greeting);
 */
export function msg<const T extends string>(message: T): T;
export function msg<const H extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...holes: CheckHoles<H>
): string | Msg;
export function msg(options: GTOptions): MsgTag;
export function msg(
  first: string | TemplateStringsArray | GTOptions,
  ...holes: unknown[]
): string | Msg | MsgTag {
  if (typeof first === 'string') return first;
  if (isTemplateStringsArray(first)) return fromTemplate(first, holes, {});
  return ((strings: TemplateStringsArray, ...nested: unknown[]) =>
    fromTemplate(strings, nested, first)) as MsgTag;
}

// Plain text stays a string, so msg`Save` reads the same before and after the
// compiler injects `$_hash`; variables or a key-changing option make a Msg.
function fromTemplate(
  strings: TemplateStringsArray,
  holes: unknown[],
  // The compiler passes `$_hash`, which public options leave out.
  { context, maxChars, requiresReview, $_hash }: MessageTreeMetadata
): string | Msg {
  if (
    holes.length === 0 &&
    context === undefined &&
    maxChars == null &&
    requiresReview !== true
  ) {
    return strings[0];
  }
  const { tree, values } = buildMessage(strings, holes);
  const metadata = { context, maxChars, requiresReview };
  return {
    tree,
    // A plain object: React rejects null-prototype objects as props.
    values: { ...values },
    $_hash: hashMessageTree(tree, { ...metadata, $_hash }),
    ...metadata,
  };
}

/**
 * Whether a value has the shape of a Msg. It can arrive as a prop or from
 * storage, so it is checked before rendering.
 */
export function isMsg(value: unknown): value is Msg {
  if (typeof value !== 'object' || value === null) return false;
  const { tree, values, $_hash, context, maxChars, requiresReview } =
    value as Record<string, unknown>;
  return (
    isMessageTree(tree) &&
    typeof values === 'object' &&
    values !== null &&
    typeof $_hash === 'string' &&
    (context === undefined || typeof context === 'string') &&
    (requiresReview === undefined || typeof requiresReview === 'boolean') &&
    (maxChars == null || Number.isFinite(maxChars))
  );
}

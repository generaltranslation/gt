import {
  formatMessageTree,
  type MessageTree,
  type MessageTreeFormats,
} from '@generaltranslation/icu';
import { formatCutoff } from '@generaltranslation/format';
import { forEachPlaceholder } from '@generaltranslation/icu/internal';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  type CreateGTParams,
  createRenderTree,
  getGT,
  loadCreateGTParams,
} from './gt';
import { isMsg, type Msg } from './msg';
import type { MessageTreeMetadata } from './renderMessage';

/**
 * Renders a message from msg(): a Msg with its captured values, which
 * `values` override, or a string as literal text. null and undefined are
 * returned unchanged.
 */
export type M = <T extends string | Msg | null | undefined>(
  message: T,
  values?: Record<string, unknown>
) => T extends string | Msg ? string : T;

type RenderableMessage = {
  tree: MessageTree;
  values: Record<string, unknown>;
  formats: MessageTreeFormats;
  metadata: MessageTreeMetadata;
};

function toRenderable(
  message: string | Msg,
  overrides: Record<string, unknown> | undefined
): RenderableMessage {
  // A string is literal text, which is its own message tree: no ICU parsing,
  // so `{` and `#` are text.
  if (typeof message === 'string') {
    return {
      tree: message,
      values: {},
      formats: {},
      metadata: {},
    };
  }
  if (!isMsg(message)) throw new Error(invalidMsgError);
  const { tree, values, formats, context, maxChars, requiresReview, $_hash } =
    message;
  // Null prototype so names like `__proto__` stay own entries.
  const merged: Record<string, unknown> = Object.create(null);
  // React Flight drops undefined-valued keys, so a source variable without a
  // value reads as the undefined it was captured as.
  forEachPlaceholder(tree, ([name]) => {
    merged[name] = undefined;
  });
  return {
    tree,
    values: Object.assign(merged, values, overrides),
    formats: formats ?? {},
    metadata: { context, maxChars, requiresReview, $_hash },
  };
}

const invalidMsgError = createGtI18nDiagnostic({
  severity: 'Error',
  whatHappened: 'm() received an object that is not a message from msg()',
  fix: 'Pass a string, or the object msg() returned with its fields unchanged',
});

/** Renders a tree in the library default locale, like legacy msg. */
function formatSource(
  tree: MessageTree,
  values: Record<string, unknown>,
  formats: MessageTreeFormats,
  maxChars: number | undefined
): string {
  // Code paths without i18n may never initialize the config.
  const timeZone = isI18nConfigInitialized()
    ? getI18nConfig().getTimeZone()
    : undefined;
  const formatted = formatMessageTree(tree, libraryDefaultLocale, values, {
    formats,
    timeZone,
  });
  const output = Array.isArray(formatted)
    ? formatted.join('')
    : String(formatted);
  return maxChars == null
    ? output
    : formatCutoff(output, { locales: libraryDefaultLocale, maxChars });
}

/** Creates an m that renders like the GT createGT returns for `params`. */
export function createMessages(params: CreateGTParams): M {
  const renderTree = createRenderTree(params);
  return ((message: string | Msg | null | undefined, values?) => {
    if (message == null) return message;
    const {
      tree,
      values: merged,
      formats,
      metadata,
    } = toRenderable(message, values);
    return renderTree(tree, merged, formats, metadata);
  }) as M;
}

/** Loads the locale's translations, then returns an m bound to that locale. */
export async function getMessages(
  conditions: Parameters<typeof getGT>[0]
): Promise<M> {
  return createMessages(await loadCreateGTParams(conditions));
}

/**
 * An m that never translates: it renders the source in the library default
 * locale, for code paths without i18n.
 *
 * @example
 * function label(m: M = mFallback) {
 *   return m(msg('Save'));
 * }
 */
export const mFallback: M = ((
  message: string | Msg | null | undefined,
  values?: Record<string, unknown>
) => {
  if (message == null) return message;
  const {
    tree,
    values: merged,
    formats,
    metadata,
  } = toRenderable(message, values);
  return formatSource(tree, merged, formats, metadata.maxChars);
}) as M;

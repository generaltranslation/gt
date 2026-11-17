import type { M, Msg } from 'gt-i18n/unstable';
import { createMessages } from 'gt-i18n/unstable/internal';
import { getReadonlyConditionStore } from '../condition-store/singleton-operations';
import { isSpa, reportServerRenderedUse } from './spaOnly';

const messages = /* @__PURE__ */ createMessages({
  getLocale: () => getReadonlyConditionStore().getLocale(),
  // Outside an SPA, m renders the source once the misuse is reported.
  getEnableI18n: () => isSpa() && getReadonlyConditionStore().getEnableI18n(),
});

function sourceOf(message: string | Msg | null | undefined) {
  if (message == null) return undefined;
  if (typeof message === 'string') return message;
  const { tree } = message;
  if (!Array.isArray(tree)) return tree;
  return tree.filter((node) => typeof node === 'string').join('');
}

/**
 * Renders a message from msg() with the current locale. Client-rendered (SPA)
 * apps only, where it also works at module level; server-rendered apps use
 * useMessages() or getMessages().
 *
 * @example
 * const greeting = msg`Hello, ${{ name }}!`;
 * m(greeting);
 * m(greeting, { name: 'Bo' });
 */
export const m = ((
  message: string | Msg | null | undefined,
  values?: Record<string, unknown>
) => {
  if (!isSpa()) {
    reportServerRenderedUse({
      name: 'm',
      fix: 'In components, use useMessages(); on the server, use getMessages()',
      message: sourceOf(message),
    });
  }
  return messages(message, values);
}) as M;

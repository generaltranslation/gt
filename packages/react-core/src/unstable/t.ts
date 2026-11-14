import type { GT, GTOptions } from 'gt-i18n/unstable';
import { getRuntimeEnvironment } from 'gt-i18n/internal';
import { createGT } from 'gt-i18n/unstable/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getReadonlyConditionStore } from '../condition-store/singleton-operations';
import { getI18nConfig } from '../setup/i18nConfig';

type LooseTag = (strings: TemplateStringsArray, ...holes: unknown[]) => string;

// Only a client-rendered app knows its locale and has its catalog loaded
// wherever t runs, module level included. Server renders use useGT() or
// getGT(), which load the request locale first.
const isSpa = () => getI18nConfig().getRenderStrategy() === 'SPA';

const gt = /* @__PURE__ */ createGT({
  getLocale: () => getReadonlyConditionStore().getLocale(),
  // Outside an SPA, t renders the source once the misuse is reported.
  getEnableI18n: () => isSpa() && getReadonlyConditionStore().getEnableI18n(),
}) as unknown as LooseTag & ((options: GTOptions) => LooseTag);

function reportServerRenderedUse(strings: TemplateStringsArray): void {
  const development = getRuntimeEnvironment() === 'development';
  const message = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened:
      't from /unstable is only available in client-rendered (SPA) apps',
    fix: 'In components, use useGT(); on the server, use getGT()',
    wayOut: development ? undefined : 'The source message was rendered',
    details: `Message: "${strings.join('')}"`,
  });
  if (development) throw new Error(message);
  console.error(message);
}

function translate(
  tag: LooseTag,
  strings: TemplateStringsArray,
  holes: unknown[]
): string {
  if (!isSpa()) reportServerRenderedUse(strings);
  return tag(strings, ...holes);
}

/**
 * Translates a message tree with the current locale. Client-rendered (SPA)
 * apps only, where it also works at module level; server-rendered apps use
 * useGT() or getGT().
 *
 * @example
 * t`Hello, ${{ name }}!`;
 * t({ context: 'button' })`Save`;
 */
export const t = ((
  first: TemplateStringsArray | GTOptions,
  ...holes: unknown[]
) => {
  if (Array.isArray(first)) {
    return translate(gt, first as unknown as TemplateStringsArray, holes);
  }
  const tag = gt(first as GTOptions);
  return (strings: TemplateStringsArray, ...nested: unknown[]) =>
    translate(tag, strings, nested);
}) as GT;

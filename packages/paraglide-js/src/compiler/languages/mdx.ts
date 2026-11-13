import type * as MdxLanguageService from '@mdx-js/language-service';
import type * as TypeScript from 'typescript';

import {
  typescriptWithoutApiError,
  type LanguageContext,
  type SourceLanguage,
} from './language.js';
import { mappingsFromVolar } from './mapping.js';

type Tools = {
  plugin: ReturnType<typeof MdxLanguageService.createMdxLanguagePlugin>;
  ts: typeof TypeScript;
};
type RemarkPlugin = NonNullable<
  Parameters<typeof MdxLanguageService.createMdxLanguagePlugin>[0]
>[number];

// Used when the project has them installed.
const REMARK_PLUGINS = ['remark-frontmatter', 'remark-gfm'];

const toolsByContext = new WeakMap<
  LanguageContext,
  Promise<Tools | undefined>
>();

/**
 * `.mdx` files, through `@mdx-js/language-service`: ESM, JSX and `{…}`
 * expressions as one JSX module, the way MDX compiles them.
 */
export const mdxLanguage: SourceLanguage = {
  name: 'mdx',
  extensions: ['.mdx'],
  requires: ['@mdx-js/language-service', 'typescript'],
  async generate(source, file, context) {
    const tools = await toolsFor(context);
    if (!tools) return undefined;

    const virtualCode = tools.plugin.createVirtualCode?.(
      file,
      'mdx',
      tools.ts.ScriptSnapshot.fromString(source),
      { getAssociatedScript: () => undefined }
    );

    // The service keeps a syntax error and generates an empty module.
    if (virtualCode?.error)
      throw new Error(`MDX: ${virtualCode.error.message}`);

    const jsx = virtualCode?.embeddedCodes?.find(
      (embedded) => embedded.id === 'jsx'
    );
    if (!jsx) throw new Error('MDX: the language service generated no JSX');

    const code = jsx.snapshot.getText(0, jsx.snapshot.getLength());
    const mappings = mappingsFromVolar(jsx.mappings);

    return { code, lang: 'jsx', mappings };
  },
};

function toolsFor(context: LanguageContext): Promise<Tools | undefined> {
  let tools = toolsByContext.get(context);

  if (!tools) {
    tools = loadTools(context);
    toolsByContext.set(context, tools);
  }

  return tools;
}

async function loadTools(context: LanguageContext): Promise<Tools | undefined> {
  const [service, ts] = await Promise.all([
    context.load<typeof MdxLanguageService>('@mdx-js/language-service'),
    context.load<{ default?: typeof TypeScript } & typeof TypeScript>(
      'typescript'
    ),
  ]);

  const typescript = ts?.default ?? ts;
  if (!service?.createMdxLanguagePlugin || !ts) return undefined;
  if (!typescript?.ScriptSnapshot)
    throw typescriptWithoutApiError('@mdx-js/language-service');

  const remarkPlugins = await installedRemarkPlugins(context);

  return {
    plugin: service.createMdxLanguagePlugin(remarkPlugins),
    ts: typescript,
  };
}

async function installedRemarkPlugins(
  context: LanguageContext
): Promise<RemarkPlugin[]> {
  const plugins = await Promise.all(
    REMARK_PLUGINS.map(async (name) => {
      const module = await context.load<{ default?: RemarkPlugin }>(name);

      return module?.default;
    })
  );

  return plugins.filter((plugin) => !!plugin);
}

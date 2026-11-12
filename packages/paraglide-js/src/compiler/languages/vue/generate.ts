import type * as VueLanguageCore from '@vue/language-core';
import type * as TypeScript from 'typescript';
import { closingTagNames } from '../elements.js';
import {
  typescriptWithoutApiError,
  type GeneratedSource,
  type LanguageContext,
  type ParseLang,
  type SkippedPart,
} from '../language.js';
import {
  mappingsFromVolar,
  withoutSource,
  type Mapping,
  type VolarMapping,
} from '../mapping.js';
import { COMPONENT_INSTANCE, normalizeVueCode } from './normalize.js';
import {
  templateElements,
  templateExpressions,
  type ParsedTemplate,
} from './template.js';

export const VUE_REQUIRES = ['@vue/language-core', 'typescript'] as const;
export const VUE_INSTALLED_WITH = { '@vue/language-core': 'vue-tsc' };

const PUG_PLUGIN = '@vue/language-plugin-pug';

type VuePlugin = VueLanguageCore.VueLanguagePlugin;
type Tools = {
  ts: typeof TypeScript;
  core: typeof VueLanguageCore;
  pug: VuePlugin | undefined;
};
type LanguagePlugin = ReturnType<typeof createLanguagePlugin>;
type VirtualCode = NonNullable<
  ReturnType<NonNullable<LanguagePlugin['createVirtualCode']>>
>;
type EmbeddedCode = {
  id: string;
  snapshot: TypeScript.IScriptSnapshot;
  mappings: VolarMapping[];
  embeddedCodes?: EmbeddedCode[];
};

const SCRIPT_LANGS = new Map<string, ParseLang>([
  ['script_ts', 'ts'],
  ['script_tsx', 'tsx'],
  ['script_js', 'js'],
  ['script_jsx', 'jsx'],
]);

const languagePlugins = new WeakMap<
  typeof VueLanguageCore,
  Map<string, LanguagePlugin>
>();

export async function generateVue(
  source: string,
  file: string,
  context: LanguageContext,
  { vitePress = false }: { vitePress?: boolean } = {}
): Promise<GeneratedSource | undefined> {
  const tools = await loadTools(context);
  if (!tools) return undefined;

  const plugin = languagePluginFor(tools, vitePress);
  const languageId = vitePress ? 'markdown' : 'vue';
  const virtualCode = plugin.createVirtualCode?.(
    file,
    languageId,
    tools.ts.ScriptSnapshot.fromString(source),
    { getAssociatedScript: () => undefined }
  );
  if (!virtualCode)
    throw new Error('@vue/language-core could not read the file');

  const script = generatedScript(virtualCode);
  const template = parsedTemplate(virtualCode);
  const expressions = template ? templateExpressions(template) : [];
  const normalized = normalizeVueCode(
    file,
    script.code,
    script.lang,
    script.mappings,
    expressions,
    source
  );

  const elements = template ? templateElements(template, source) : [];
  const closingTags = closingTagNames(elements, source);
  const mappings = withoutSource(normalized.mappings, closingTags);

  return {
    code: normalized.code,
    lang: script.lang,
    mappings,
    elements,
    scopeObjects: [COMPONENT_INSTANCE],
    props: { calls: ['defineProps', 'withDefaults'], undeclared: true },
    // `const __VLS_0 = Label; const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, …);
    // __VLS_1({ message: … })`
    componentInstances: { via: 'call', path: [] },
    skipped: unreadPugTemplate(tools, virtualCode),
  };
}

/** Without its plugin a pug template is left out; the scripts are still read. */
function unreadPugTemplate(
  tools: Tools,
  virtualCode: VirtualCode
): SkippedPart | undefined {
  const isUnread = virtualCode.sfc.template?.lang === 'pug' && !tools.pug;

  return isUnread
    ? { name: 'pug templates', requires: [PUG_PLUGIN] }
    : undefined;
}

/** Whether Vue files can be read: false without the tools, or with unusable ones. */
export function hasVueTools(context: LanguageContext): Promise<boolean> {
  return loadTools(context).then(
    (tools) => tools !== undefined,
    () => false
  );
}

async function loadTools(context: LanguageContext): Promise<Tools | undefined> {
  const [ts, core, pug] = await Promise.all([
    context.load<typeof TypeScript & { default?: typeof TypeScript }>(
      'typescript'
    ),
    context.load<typeof VueLanguageCore>('@vue/language-core'),
    context.load<{ default?: VuePlugin }>(PUG_PLUGIN),
  ]);

  const typescript = ts?.ScriptSnapshot ? ts : ts?.default;
  if (!ts || !core?.createVueLanguagePlugin) return undefined;
  if (!typescript?.ScriptSnapshot)
    throw typescriptWithoutApiError('@vue/language-core');

  const pugExport = pug?.default ?? pug;
  const pugPlugin = typeof pugExport === 'function' ? pugExport : undefined;

  return { ts: typescript, core, pug: pugPlugin };
}

function languagePluginFor(tools: Tools, vitePress: boolean): LanguagePlugin {
  let pluginsByOptions = languagePlugins.get(tools.core);

  if (!pluginsByOptions) {
    pluginsByOptions = new Map();
    languagePlugins.set(tools.core, pluginsByOptions);
  }

  const options = `${vitePress}:${tools.pug !== undefined}`;
  let plugin = pluginsByOptions.get(options);

  if (!plugin) {
    plugin = createLanguagePlugin(tools, vitePress);
    pluginsByOptions.set(options, plugin);
  }

  return plugin;
}

function createLanguagePlugin({ ts, core, pug }: Tools, vitePress: boolean) {
  const options = {
    ...core.getDefaultCompilerOptions(),
    ...(vitePress && { vitePressExtensions: ['.md'] }),
    plugins: pug ? [pug] : [],
  };

  return core.createVueLanguagePlugin<string>(ts, {}, options, (id) => id);
}

function generatedScript(virtualCode: VirtualCode): {
  code: string;
  lang: ParseLang;
  mappings: Mapping[];
} {
  for (const { id, snapshot, mappings } of embeddedCodes(virtualCode)) {
    const lang = SCRIPT_LANGS.get(id);
    if (!lang) continue;

    const code = snapshot.getText(0, snapshot.getLength());
    return { code, lang, mappings: mappingsFromVolar(mappings) };
  }

  throw new Error('@vue/language-core generated no script');
}

function parsedTemplate(virtualCode: VirtualCode): ParsedTemplate | undefined {
  const { template } = virtualCode.sfc;
  if (!template?.ast) return undefined;

  // -1 for VitePress, whose template is the whole file after a leading newline.
  const contentStart = template.startTagEnd ?? 0;

  return {
    ast: template.ast,
    contentStart,
    contentEnd: contentStart + template.content.length,
    isPug: template.lang === 'pug',
  };
}

function embeddedCodes(code: {
  embeddedCodes?: EmbeddedCode[];
}): EmbeddedCode[] {
  return (code.embeddedCodes ?? []).flatMap((embedded) => [
    embedded,
    ...embeddedCodes(embedded),
  ]);
}

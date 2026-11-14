import type * as VueLanguageCore from '@vue/language-core';
import type * as TypeScript from 'typescript';
import {
  typescriptWithoutApiError,
  type GeneratedSource,
  type LanguageContext,
  type ParseLang,
} from '../language.js';
import {
  mappingsFromVolar,
  type Mapping,
  type VolarMapping,
} from '../mapping.js';
import { COMPONENT_INSTANCE, normalizeVueCode } from './normalize.js';
import { templateExpressions, type ParsedTemplate } from './template.js';

export const VUE_REQUIRES = ['@vue/language-core', 'typescript'] as const;
/** Pug templates are read when it is installed. */
export const VUE_USES = ['@vue/language-plugin-pug'];
export const VUE_INSTALLED_WITH = { '@vue/language-core': 'vue-tsc' };

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

  // @vue/language-core keeps every virtual code it creates, by file, for
  // the life of the process: about 30 MB for a component of 10,000 lines.
  // Each file is generated once, so it is not kept.
  plugin.disposeVirtualCode?.(file, virtualCode);

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

  return {
    code: normalized.code,
    lang: script.lang,
    mappings: normalized.mappings,
    scopeObjects: [COMPONENT_INSTANCE],
    props: { calls: ['defineProps', 'withDefaults'], undeclared: true },
    // `const __VLS_0 = Label; const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, …);
    // __VLS_1({ message: … })`
    componentInstances: { via: 'call', path: [] },
  };
}

async function loadTools(context: LanguageContext): Promise<Tools | undefined> {
  const [ts, core, pug] = await Promise.all([
    context.load<typeof TypeScript & { default?: typeof TypeScript }>(
      'typescript'
    ),
    context.load<typeof VueLanguageCore>('@vue/language-core'),
    context.load<{ default?: VuePlugin }>('@vue/language-plugin-pug'),
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
  return { ast: template.ast, contentStart: template.startTagEnd ?? 0 };
}

function embeddedCodes(code: {
  embeddedCodes?: EmbeddedCode[];
}): EmbeddedCode[] {
  return (code.embeddedCodes ?? []).flatMap((embedded) => [
    embedded,
    ...embeddedCodes(embedded),
  ]);
}

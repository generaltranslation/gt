// The public API: `collectContext`, and what its options take. Everything else
// under `./compiler/` is internal.

// Writing the metadata files: what the `paraglide-context` CLI runs.
export {
  collectContext,
  type CollectContextOptions,
} from './compiler/context.js';
export type { ParaglideContextOptions } from './compiler/options.js';
export type { CollectorLogger } from './compiler/collector/collector.js';
export { DEFAULT_EXCLUDE } from './compiler/project/files.js';
export type { AutoImportOptions } from './compiler/project/auto-imports.js';

// `targets`: what counts as Paraglide.
export {
  adapterTargets,
  defaultTargets,
  defineTarget,
  generatedFileTarget,
  messagesTarget,
  packageTarget,
  registryTarget,
  runtimeTarget,
  serverTarget,
  type ParaglideTarget,
  type SymbolSpec,
  type TargetFile,
} from './compiler/paraglide/targets.js';

// `languages`: file formats, and what a new one returns.
export {
  analogLanguage,
  angularComponentLanguage,
  angularTemplateLanguage,
  astroLanguage,
  defaultLanguages,
  emberLanguage,
  markdownLanguage,
  markoLanguage,
  mdxLanguage,
  svelteLanguage,
  vueLanguage,
} from './compiler/languages/index.js';
export type {
  ComponentFields,
  GeneratedScript,
  GeneratedSource,
  LanguageContext,
  ParseLang,
  SkippedPart,
  SourceLanguage,
} from './compiler/languages/language.js';
export {
  mappingsFromSourceMap,
  mappingsFromVolar,
  type Mapping,
} from './compiler/languages/mapping.js';
export type { SourceElement } from './compiler/languages/elements.js';

// `alias` and `bundlerConfigs`: where import aliases come from.
export { defaultBundlerConfigs } from './compiler/bundler-configs/index.js';
export { viteConfig } from './compiler/bundler-configs/vite.js';
export {
  rspackConfig,
  webpackConfig,
  webpackLikeConfig,
} from './compiler/bundler-configs/webpack.js';
export type {
  BundlerConfig,
  ConfigContext,
  ConfigFailure,
  ImportResolution,
} from './compiler/bundler-configs/bundler-config.js';
export type {
  AliasOption,
  ImportAlias,
} from './compiler/bundler-configs/alias.js';

// Running the analysis with another resolver.
export {
  createCollector,
  type CollectorEnvironment,
} from './compiler/collector/create.js';
export type {
  ContextCollector,
  Resolver,
} from './compiler/collector/collector.js';
export {
  nodeResolver,
  type NodeResolverOptions,
} from './compiler/resolver/node-resolver.js';
export {
  ProjectResolver,
  type ProjectResolverEnvironment,
  type ProjectResolverOptions,
} from './compiler/resolver/project-resolver.js';

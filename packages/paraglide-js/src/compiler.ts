// Bundler plugins. Each runs the same collector; see `lib/compiler/collector/create.ts`.
export { paraglideContext } from '../lib/compiler/plugins/vite.js';
export { ParaglideContextWebpackPlugin } from '../lib/compiler/plugins/webpack.js';
export {
  paraglideContextRollup,
  type ParaglideContextRollupPlugin,
} from '../lib/compiler/plugins/rollup.js';
export {
  paraglideContextEsbuild,
  type ParaglideContextEsbuildPlugin,
} from '../lib/compiler/plugins/esbuild.js';
// Without running a bundler: the `paraglide-context` CLI uses these.
export {
  collectContext,
  watchContext,
  type CollectContextOptions,
  type ContextWatcher,
} from '../lib/compiler/plugins/node.js';
export {
  nodeResolver,
  type NodeResolverOptions,
} from '../lib/compiler/plugins/node-resolver.js';
export {
  ProjectResolver,
  type ProjectResolverEnvironment,
  type ProjectResolverOptions,
} from '../lib/compiler/plugins/project-resolver.js';

// Bundler configs: where the CLI reads import aliases from.
export { defaultBundlerConfigs } from '../lib/compiler/bundler-configs/index.js';
export { viteConfig } from '../lib/compiler/bundler-configs/vite.js';
export {
  rspackConfig,
  webpackConfig,
  webpackLikeConfig,
} from '../lib/compiler/bundler-configs/webpack.js';
export type {
  BundlerConfig,
  ConfigContext,
  ConfigFailure,
  ImportResolution,
} from '../lib/compiler/bundler-configs/bundler-config.js';
export {
  applyAliases,
  type AliasOption,
  type ImportAlias,
} from '../lib/compiler/bundler-configs/alias.js';
export type { ParaglideContextOptions } from '../lib/compiler/options.js';

// Running the analysis from another bundler or a script.
export {
  ContextCollector,
  type CollectorLogger,
  type Resolver,
} from '../lib/compiler/collector/collector.js';
export {
  createCollector,
  type CollectorEnvironment,
} from '../lib/compiler/collector/create.js';

// The user's project: which files are analyzed, auto-imports.
export { DEFAULT_EXCLUDE } from '../lib/compiler/project/files.js';
export type { AutoImportOptions } from '../lib/compiler/project/auto-imports.js';

// inlang: the projects Paraglide compiles, and their message files.
export {
  readInlangProject,
  type InlangProject,
} from '../lib/compiler/inlang/project.js';
export type {
  MessageFile,
  MessageKey,
} from '../lib/compiler/inlang/message-file.js';

// Paraglide: what counts as Paraglide.
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
} from '../lib/compiler/paraglide/targets.js';

// Analysis: modules, scopes, usages.
export {
  ModuleGraph,
  type GlobalBinding,
  type ModuleGraphOptions,
  type ModuleRecord,
  type ParsedModule,
} from '../lib/compiler/analysis/module-graph.js';
export { analyzeModule } from '../lib/compiler/analysis/analyze.js';
export type { ESTree, Node } from '../lib/compiler/analysis/ast.js';
export type {
  CatalogCheck,
  ElementContext,
  ElementRange,
  FileUsages,
  ParaglideUsage,
  TrackedNamespace,
  TrackedSymbol,
  TrackedValue,
  UsageKind,
} from '../lib/compiler/analysis/types.js';

// Languages: file formats, and the tools to add one.
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
} from '../lib/compiler/languages/index.js';
export {
  isSourceFile,
  NO_PACKAGES,
  parseSource,
  type ComponentFields,
  type GeneratedSource,
  type ParseFailure,
  type LanguageContext,
  type ParseFunction,
  type ParseLang,
  type SourceLanguage,
} from '../lib/compiler/languages/language.js';
export {
  mappingsFromSourceMap,
  mappingsFromVolar,
  remapProgram,
  type Mapping,
} from '../lib/compiler/languages/mapping.js';
export {
  componentTagAt,
  elementContextAt,
  type SourceElement,
} from '../lib/compiler/languages/elements.js';
export { applyEdits, type Edit } from '../lib/compiler/languages/edits.js';

// Output.
export {
  metadataPath,
  renderMetadataFile,
  type MetadataFileInput,
} from '../lib/compiler/output/metadata.js';
export {
  sourceCodeByMessage,
  sourceSnippet,
  type SourceCode,
  type SourceCodeByFile,
  type SourceCodeOptions,
} from '../lib/compiler/output/source-code.js';

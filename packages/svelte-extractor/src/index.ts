export {
  analyzeSvelteSource,
  transformSvelteSource,
} from './internal/source.js';
export type {
  AnalyzeSvelteSourceOptions,
  TransformSvelteSourceOptions,
  TransformSvelteSourceResult,
} from './internal/source.js';
export { normalizeJsxText } from './internal/whitespace.js';
export type {
  GTRuntimeMetadata,
  SourceLocation,
  StringSite,
  SvelteAnalysis,
  SvelteExtractionError,
  SvelteParse,
  TranslationMetadata,
  TranslationSite,
} from './internal/types.js';

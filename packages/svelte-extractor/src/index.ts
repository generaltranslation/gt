export {
  analyzeSvelteSource,
  transformSvelteSource,
} from './internal/source.js';
export type {
  AnalyzeSvelteSourceOptions,
  TransformSvelteSourceOptions,
  TransformSvelteSourceResult,
} from './internal/source.js';
export { findSvelteTags } from './internal/tags.js';
export type { SvelteTag } from './internal/tags.js';
export type {
  GTRuntimeMetadata,
  SourceCodeContext,
  SourceLocation,
  StringSite,
  SvelteAnalysis,
  SvelteExtractionError,
  SvelteParse,
  TranslationMetadata,
  TranslationSite,
} from './internal/types.js';

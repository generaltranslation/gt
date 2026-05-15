export { createExtractor } from './createExtractor';
export {
  evaluateStringExpression,
  INVALID_TEMPLATE_ESCAPE_ERROR,
} from './string/evaluateStringExpression';
export {
  flattenExpressionToParts,
  type FlattenExpressionError,
  type Part,
} from './string/flattenExpressionToParts';
export {
  resolveStaticExpression,
  type ResolveStaticExpressionError,
} from './string/resolveStaticExpression';
export {
  stringNodeToStaticValues,
  stringNodeToVariants,
} from './string/variants';
export type {
  ExtractionDiagnostic,
  ExtractionMode,
  ExtractionResult,
  Extractor,
  ExtractorHost,
  ExtractorOptions,
  ExtractStringExpressionParams,
  StringChoiceNode,
  StringDeriveNode,
  StringDynamicNode,
  StringExpressionNode,
  StringSequenceNode,
  StringStaticNode,
} from './types';

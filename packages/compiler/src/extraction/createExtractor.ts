import type { Extractor, ExtractorHost, ExtractorOptions } from './types';
import { evaluateStringExpression } from './string/evaluateStringExpression';

export function createExtractor(
  _host: ExtractorHost,
  _options: ExtractorOptions
): Extractor {
  return {
    evaluateStringExpression({ path }) {
      return evaluateStringExpression(path);
    },
  };
}

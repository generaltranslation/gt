import type { ParseFunction } from '../languages/language.js';
import {
  parseSync,
  rawTransferSupported,
  type ParseResult,
  type ParserOptions,
} from 'oxc-parser';

/** Raw transfer is several times faster than JSON, but experimental: used until it fails once. */
let usesRawTransfer = rawTransferSupported();

export function parseCode(
  file: string,
  code: string,
  options: ParserOptions
): ParseResult {
  if (usesRawTransfer) {
    try {
      return parseSync(file, code, withRawTransfer(options));
    } catch {
      usesRawTransfer = false;
    }
  }

  return parseSync(file, code, options);
}

// The option is not in oxc-parser's types.
function withRawTransfer(options: ParserOptions): ParserOptions {
  return { ...options, experimentalRawTransfer: true } as ParserOptions;
}

/** How source files are parsed for the analysis. */
export const parseModuleCode: ParseFunction = (file, code, lang, options) =>
  parseCode(file, code, {
    lang,
    range: options?.range ?? false,
    astType: 'ts',
  }) as unknown as ReturnType<ParseFunction>;

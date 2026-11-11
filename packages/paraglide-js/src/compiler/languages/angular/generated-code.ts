import type { Mapping } from '../mapping.js';

/** Code built from copies of the source (mapped) and glue (unmapped). */
export class GeneratedCode {
  code = '';
  readonly mappings: Mapping[] = [];

  constructor(readonly source: string) {}

  glue(text: string): void {
    this.code += text;
  }

  copy(start: number, end: number): void {
    if (end <= start) return;

    this.mappings.push({
      generated: this.code.length,
      source: start,
      length: end - start,
    });
    this.code += this.source.slice(start, end);
  }
}

/** The `LexerRange` Angular's parsers take, for `source[start, end)`. */
export function lexerRange(source: string, start: number, end: number) {
  const before = source.slice(0, start);
  const lineStart = before.lastIndexOf('\n') + 1;

  return {
    startPos: start,
    startLine: before.split('\n').length - 1,
    startCol: start - lineStart,
    endPos: end,
  };
}

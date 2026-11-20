import {
  originalPositionFor,
  TraceMap,
  type SourceMapInput,
} from '@jridgewell/trace-mapping';

/** Where the first `token` of a text is, as a source map counts it. */
export function locate(
  text: string,
  token: string
): { line: number; column: number } {
  const lines = text.split('\n');
  const index = lines.findIndex((line) => line.includes(token));
  if (index === -1) throw new Error(`The text does not hold ${token}`);
  return { line: index + 1, column: lines[index].indexOf(token) };
}

/** Where a source map says the first `token` of the code it is for comes from. */
export function trace(map: unknown, code: string, token: string) {
  const { source, line, column } = originalPositionFor(
    new TraceMap(map as SourceMapInput),
    locate(code, token)
  );
  return { source, line, column };
}

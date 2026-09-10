type RequestFunction<Result> = () => Promise<Result>;

/** Normalize aliased request modules that may use a default or named export. */
export function resolveRequestFunction<Result>(
  module: unknown,
  exportName: string,
  unresolvedWarning: string
): RequestFunction<Result> | undefined {
  if (typeof module === 'function') {
    return module as RequestFunction<Result>;
  }
  if (typeof module === 'object' && module !== null) {
    const exports = module as Record<string, unknown>;
    const defaultExport = 'default' in exports ? exports.default : undefined;
    const namedExport = exportName in exports ? exports[exportName] : undefined;
    const requestFunction =
      typeof defaultExport === 'function' ? defaultExport : namedExport;
    if (typeof requestFunction === 'function') {
      return requestFunction as RequestFunction<Result>;
    }
  }
  console.warn(unresolvedWarning);
}

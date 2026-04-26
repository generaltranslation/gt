export function createTsdownConfig(
  entry: string[],
  deps?: { alwaysBundle?: (string | RegExp)[] }
) {
  return [
    {
      entry,
      format: ['cjs'] as const,
      dts: true,
      sourcemap: true,
      clean: true,
      deps: { onlyBundle: false, ...deps },
    },
    { entry, format: ['esm'] as const, sourcemap: true },
  ];
}

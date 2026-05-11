import type { UserConfig } from 'tsdown';

export function createTsdownConfig(entry: string[], deps?: UserConfig['deps']) {
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

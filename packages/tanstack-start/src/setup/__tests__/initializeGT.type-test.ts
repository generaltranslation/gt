// Checked by `tsc --noEmit` (the typecheck script); vitest does not run it.
import type { InitializeGTParams } from '../../types/InitializeGTParams';

// What TypeScript infers for `import gtConfig from '../gt.config.json'`:
// JSON imports widen files.gt.splitting to string.
declare const gtConfig: {
  defaultLocale: string;
  locales: string[];
  files: { gt: { output: string; splitting: string } };
};
declare const loadTranslations: (locale: string) => Promise<object>;

// What GT initializes with from the gtTanstackStart() config module.
export const params: InitializeGTParams = { ...gtConfig, loadTranslations };

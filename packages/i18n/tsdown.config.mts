import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const mainEntries = [
  'src/index.ts',
  'src/types.ts',
  'src/internal.ts',
  'src/internal-types.ts',
  'src/i18n-cache/SnapshotStore.ts',
  'src/i18n-cache/createTranslationLoader.ts',
];
const [mainCjs, mainEsm] = createTsdownConfig(mainEntries);
const [cacheCjs, cacheEsm] = createTsdownConfig([
  'src/i18n-cache/I18nCache.ts',
]);
const [runtimeResolverCjs, runtimeResolverEsm] = createTsdownConfig([
  'src/i18n-cache/RuntimeTranslationResolver.ts',
]);

export default defineConfig([
  mainCjs,
  mainEsm,
  { ...cacheCjs, clean: false },
  { ...cacheEsm, clean: false },
  { ...runtimeResolverCjs, clean: false },
  { ...runtimeResolverEsm, clean: false },
]);

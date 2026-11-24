import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from '../../vitest.preset.mts';

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    // react-core brings its own copy of React; a rendered provider needs one.
    resolve: { dedupe: ['react'] },
    test: {
      server: { deps: { inline: [/@generaltranslation\/react-core/] } },
    },
  })
);

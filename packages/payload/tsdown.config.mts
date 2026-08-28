import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-dom$/,
    /^react-dom\//,
    /^next$/,
    /^next\//,
    /^payload$/,
    /^payload\//,
    /^@payloadcms\//,
    /^generaltranslation$/,
  ],
  alwaysBundle: [/^generaltranslation\//],
};

const entries = ['src/index.ts', 'src/client.ts'];

export default defineConfig(
  entries.map((entry, index) => {
    const [, esmConfig] = createTsdownConfig([entry], deps);
    return {
      ...esmConfig,
      clean: index === 0,
      dts: true,
      deps: {
        onlyBundle: false,
        ...deps,
      },
    };
  })
);

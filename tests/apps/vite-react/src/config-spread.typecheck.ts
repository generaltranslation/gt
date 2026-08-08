import { vite as gtCompiler } from '@generaltranslation/compiler';
import type { GTUnpluginOptions } from '@generaltranslation/compiler';
import { initializeGTSPA } from 'gt-react';
import gtConfig from './gt-config-with-optional-files.json';

type CompilerGTConfig = NonNullable<GTUnpluginOptions['gtConfig']>;

// TypeScript widens JSON string literals and arrays. The JSON file is checked
// against the same exact contract by the CLI schema; assert that validated
// boundary once rather than weakening the public compiler configuration type.
const typedGTConfig = gtConfig as unknown as CompilerGTConfig;

const invalidWhitespace: GTUnpluginOptions = {
  files: {
    gt: {
      parsingFlags: {
        vueCompilerOptions: {
          // @ts-expect-error Vue only accepts its two documented modes.
          whitespace: 'collapse',
        },
      },
    },
  },
};

const invalidDelimiters: GTUnpluginOptions = {
  files: {
    gt: {
      parsingFlags: {
        vueCompilerOptions: {
          // @ts-expect-error Vue delimiters are exactly an opening/closing pair.
          delimiters: ['[['],
        },
      },
    },
  },
};

initializeGTSPA({});

initializeGTSPA({
  defaultLocale: 'en',
  locales: ['fr'],
  loadTranslations: async () => ({}),
});

initializeGTSPA({
  ...typedGTConfig,
  loadTranslations: async () => ({}),
});

gtCompiler({ defaultLocale: 'en', locales: ['fr'] });
gtCompiler({ ...typedGTConfig });
gtCompiler({ gtConfig: typedGTConfig });

void invalidWhitespace;
void invalidDelimiters;

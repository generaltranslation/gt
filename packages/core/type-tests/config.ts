import type { GTConfig, GTParsingFlags } from '../src/types.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type VueCompilerOptions = NonNullable<GTParsingFlags['vueCompilerOptions']>;
type ExpectedVueCompilerOptions = {
  whitespace?: 'condense' | 'preserve';
  delimiters?: [string, string];
};

type _VueCompilerOptionsMatch = Expect<
  Equal<VueCompilerOptions, ExpectedVueCompilerOptions>
>;

const validConfig = {
  files: {
    gt: {
      parsingFlags: {
        viteConfigPath: 'vite.config.ts',
        vueCompilerOptions: {
          whitespace: 'preserve',
          delimiters: ['[[', ']]'],
        },
      },
    },
  },
} satisfies GTConfig;

const invalidWhitespace: GTConfig = {
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

const invalidViteConfigPath: GTConfig = {
  files: {
    gt: {
      parsingFlags: {
        // @ts-expect-error Vite config paths must be strings.
        viteConfigPath: 42,
      },
    },
  },
};

const invalidDelimiters: GTConfig = {
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

void validConfig;
void invalidWhitespace;
void invalidViteConfigPath;
void invalidDelimiters;

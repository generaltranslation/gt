import type { GTConfig, GTParsingFlags } from '../../types.js';

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

// Model providers are the API's values; a JSON import needs `satisfies GTConfig`.
const validModelProvider = { modelProvider: 'OPENAI' } satisfies GTConfig;
const invalidModelProvider: GTConfig = {
  // @ts-expect-error Lowercase providers are not API values.
  modelProvider: 'openai',
};

void validConfig;
void validModelProvider;
void invalidModelProvider;
void invalidWhitespace;
void invalidViteConfigPath;
void invalidDelimiters;

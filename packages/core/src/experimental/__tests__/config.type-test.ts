import type { GTConfig } from '../../types-dir/config';
import type { GTExperimentalSettings } from '../locale-twins/config';

type GTConfigWithExperimental = GTConfig & GTExperimentalSettings;

// Apps spread an imported gt.config.json into the runtime, and JSON imports
// widen experimental.splitting to string (this is the type TypeScript
// infers); runtimes validate the value instead.
declare const gtConfigJson: {
  defaultLocale: string;
  locales: string[];
  files: { gt: { output: string } };
  experimental: { splitting: string };
};
const configFromJson: GTConfigWithExperimental = { ...gtConfigJson };

const localeTwins: GTConfigWithExperimental = {
  experimental: { splitting: 'locale-twins' },
};

const invalidSplitting: GTConfigWithExperimental = {
  experimental: {
    // @ts-expect-error a splitting strategy is a string.
    splitting: true,
  },
};

const splittingOutsideExperimental: GTConfigWithExperimental = {
  files: {
    gt: {
      // @ts-expect-error locale twins are configured under experimental.
      splitting: 'locale-twins',
    },
  },
};

void configFromJson;
void localeTwins;
void invalidSplitting;
void splittingOutsideExperimental;

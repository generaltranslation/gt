import { readFileSync } from 'node:fs';

const settings = JSON.parse(readFileSync('regression-config.json', 'utf8'));

export default {
  trailingSlash: settings.trailingSlash,
  experimental: { cpus: 2 },
  env: {
    _GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    }),
    _GENERALTRANSLATION_GT_SERVICES_ENABLED: 'false',
    _GENERALTRANSLATION_IGNORE_BROWSER_LOCALES: 'true',
    _GENERALTRANSLATION_PATH_REGEX: '',
  },
};

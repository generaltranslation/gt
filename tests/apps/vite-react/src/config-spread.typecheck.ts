import { vite as gtCompiler } from '@generaltranslation/compiler';
import { initializeGTSPA } from 'gt-react';
import gtConfig from './gt-config-with-optional-files.json';

initializeGTSPA({});

initializeGTSPA({
  defaultLocale: 'en',
  locales: ['fr'],
  loadTranslations: async () => ({}),
});

initializeGTSPA({
  ...gtConfig,
  loadTranslations: async () => ({}),
});

gtCompiler({ defaultLocale: 'en', locales: ['fr'] });
gtCompiler({ ...gtConfig });
gtCompiler({ gtConfig });

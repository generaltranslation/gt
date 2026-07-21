import type { ReactFrameworkObject } from '../types/index.js';

export const REACT_SPA_QUICKSTART_URL =
  'https://generaltranslation.com/docs/react/react-spa-quickstart';
export const REACT_SERVER_QUICKSTART_URL =
  'https://generaltranslation.com/docs/react/react-quickstart';
export const REACT_CONFIGURING_GUIDE_URL =
  'https://generaltranslation.com/docs/react/guides/configuring';
export const REACT_LOAD_TRANSLATIONS_URL =
  'https://generaltranslation.com/docs/react/reference/functions/load-translations';
export const NEXT_APP_QUICKSTART_URL =
  'https://generaltranslation.com/docs/react/nextjs-quickstart';
export const NEXT_PAGES_QUICKSTART_URL =
  'https://generaltranslation.com/docs/react/nextjs-pages-router-quickstart';

type ReactSetupGuidance = {
  defaultsDescription: string;
  promptAction: string;
  completion: string;
  docsUrl: string;
};

export function getReactSetupGuidance(
  framework: ReactFrameworkObject
): ReactSetupGuidance {
  if (framework.name === 'vite') {
    return {
      defaultsDescription:
        'SPA initialization with initializeGTSPA (no GTProvider)',
      promptAction:
        'prepare the SPA setup (after the wizard, call initializeGTSPA before rendering; a GTProvider is not needed)',
      completion:
        'Next step: call initializeGTSPA with your config and loadTranslations before rendering. Do not add a GTProvider.',
      docsUrl: REACT_SPA_QUICKSTART_URL,
    };
  }

  if (framework.name === 'next-app') {
    return {
      defaultsDescription: 'Next.js App Router setup with GTProvider',
      promptAction: 'add the GTProvider',
      completion:
        'Next step: review the Next.js App Router setup and start internationalizing.',
      docsUrl: NEXT_APP_QUICKSTART_URL,
    };
  }

  if (framework.name === 'next-pages') {
    return {
      defaultsDescription: 'Next.js Pages Router setup',
      promptAction: 'prepare the Next.js Pages Router setup',
      completion:
        'Next step: review the Next.js Pages Router setup and start internationalizing.',
      docsUrl: NEXT_PAGES_QUICKSTART_URL,
    };
  }

  if (framework.name === 'gatsby' || framework.name === 'redwood') {
    return {
      defaultsDescription:
        'server-rendered initialization with initializeGT and hydrated GTProvider',
      promptAction:
        'prepare the server-rendered setup (after the wizard, call initializeGT and hydrate GTProvider with the locale and translations)',
      completion:
        'Next step: call initializeGT at module scope, load the locale and translations on the server, and hydrate GTProvider with both values.',
      docsUrl: REACT_SERVER_QUICKSTART_URL,
    };
  }

  return {
    defaultsDescription: 'rendering-model-specific React initialization',
    promptAction:
      'prepare the React setup (SPAs use initializeGTSPA without GTProvider; server-rendered apps use initializeGT and hydrate GTProvider with the locale and translations)',
    completion:
      'Next step: finish setup for your rendering model. SPAs call initializeGTSPA before rendering and do not need GTProvider. Server-rendered apps call initializeGT, load the locale and translations on the server, and hydrate GTProvider with both values.',
    docsUrl: REACT_CONFIGURING_GUIDE_URL,
  };
}

export const LOAD_TRANSLATIONS_SETUP_GUIDANCE = `Connect this loader through the setup for your framework. With gt-react, SPAs pass it to initializeGTSPA; server-rendered apps pass it to initializeGT, then hydrate GTProvider with the locale and translations.
See ${REACT_LOAD_TRANSLATIONS_URL}`;

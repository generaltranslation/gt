'use client';

// Dedicated build entry for the interactive locale selector. Bundling a
// 'use client' module into another entry drops the directive, which would
// silently break the server/client boundary — so the context build configs
// keep imports of this module external and rewrite them to the built
// dist/locale-selector.client artifact (see tsdown.config.mts).

export {
  LocaleSelector as LocaleSelectorClient,
  type LocaleSelectorProps,
} from './components/LocaleSelector.client';

'use client';

// Dedicated build entry for the interactive locale selector. The RSC facade
// (components/LocaleSelector.rsc.tsx) references this module through the
// gt-react/internal/locale-selector-client subpath instead of a relative
// import: bundling a 'use client' module into another entry drops the
// directive, which would silently break the server/client boundary.

export {
  LocaleSelector as LocaleSelectorClient,
  type LocaleSelectorProps,
} from './components/LocaleSelector.client';

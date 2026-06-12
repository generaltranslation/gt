'use client';
/**
 * This is a small boundary for RSC consumption of client components
 * Cannot be consumed through gt-react/index.rsc as deciding btwn
 * gt-react/index.server and gt-react/index.client can only happen
 * here. This matters for GTProvider, but not for LocaleSelector.
 * This pattern is just good to follow for carrying over different
 * behaviors between client and server from gt-react.
 */
export {
  GTProvider as Client_GTProvider,
  LocaleSelector as Client_LocaleSelector,
} from 'gt-react/context';

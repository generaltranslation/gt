'use client';

// Dedicated client boundary for values that gt-react/context.rsc may render
// from a React Server Component. Keep this entry explicit and small so the
// emitted module preserves the directive without pulling in the broad
// context.server barrel.

export { LocaleSelector } from './components/LocaleSelector';
export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
export {
  GtInternalTranslateJsx,
  T,
} from '@generaltranslation/react-core/context';

import { createGtNextDiagnostic } from '../errors/diagnostics';
import type { GTDictionaryProviderProps } from './GTDictionaryProvider';

const clientGTDictionaryProviderError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'GTDictionaryProvider can only be rendered from a server component',
  why: 'it loads your dictionaries on the server, so client components and the Pages Router are not supported',
  fix: "Render <GTDictionaryProvider> from 'gt-next/compat' in an App Router layout or page",
});

/**
 * GTDictionaryProvider outside React Server Components, where it cannot load
 * dictionaries.
 */
export function GTDictionaryProvider(_props: GTDictionaryProviderProps): never {
  throw new Error(clientGTDictionaryProviderError);
}

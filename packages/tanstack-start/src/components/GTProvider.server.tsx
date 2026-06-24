import {
  GTProvider as ReactGTProvider,
  type SharedGTProviderProps,
} from 'gt-react';
import { parseLocale } from '../functions/parseLocale';

/**
 * Server-side TanStack Start provider.
 *
 * The request locale must be resolved during SSR so the server-rendered HTML
 * matches the browser condition store after locale cookie changes.
 */
export function GTProvider(props: SharedGTProviderProps) {
  return <ReactGTProvider {...props} locale={parseLocale()} />;
}

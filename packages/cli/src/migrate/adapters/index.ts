import { nextIntlAdapter } from './nextIntl.js';
import { reactIntlAdapter } from './reactIntl.js';
import type { SourceAdapter } from './types.js';

/**
 * The registered source adapters, keyed by SupportedLibraries id. Later stacked
 * PRs add react-i18next here; the driver and CLI read the supported set from
 * this registry so the "unsupported source" error and the `--from` help grow
 * automatically.
 */
const ADAPTERS: SourceAdapter[] = [nextIntlAdapter, reactIntlAdapter];

/** Looks up the adapter for a library id, or undefined when unsupported. */
export function getAdapter(id: string): SourceAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === id);
}

/** The library ids `gt migrate` can migrate from today (for error/help text). */
export function supportedSourceIds(): string[] {
  return ADAPTERS.map((adapter) => adapter.id);
}

export { nextIntlAdapter, reactIntlAdapter };
export type { SourceAdapter };

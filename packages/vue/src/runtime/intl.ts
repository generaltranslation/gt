import type {
  GTIntl as ResolvedGTIntl,
  LocaleConfig,
} from '@generaltranslation/format';
import { GTIntl } from 'generaltranslation/internal';

// Its own module: the SPA runtime loads it on demand, and a bundler keeps
// only GTIntl from generaltranslation/internal, not the whole entry.
/** A GTIntl from `generaltranslation`, which fills in what the config leaves out. */
export const createIntl = (localeConfig: LocaleConfig): ResolvedGTIntl =>
  new GTIntl(localeConfig);

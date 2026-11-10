import { intlCache as icuIntlCache } from '@generaltranslation/icu/internal';
import { CutoffFormatConstructor } from '../formatting/custom-formats/CutoffFormat/CutoffFormat';

/**
 * The Intl cache of `@generaltranslation/icu`, with this package's custom
 * formats. Both packages share its instances.
 */
export const intlCache = icuIntlCache.extend({
  CutoffFormat: CutoffFormatConstructor,
});

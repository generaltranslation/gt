import { GT_IMPORT_SOURCES } from '../../utils/constants/gt/constants';

/** The `/experimental` GT entry points, which export the locale twin API. */
export const EXPERIMENTAL_IMPORT_SOURCES = {
  GT_REACT: 'gt-react/experimental',
  GT_TANSTACK_START: 'gt-tanstack-start/experimental',
} as const;

/** The compiler-injected registration function of a locale twin. */
export const LOCALE_TWIN_REGISTRATION_FUNCTION = 'GtInternalRegisterLocaleTwin';

/**
 * The import source for the locale twins registration call, given a GT import
 * source the module already uses: the `/experimental` entry points export it,
 * and gt-i18n from `gt-i18n/internal/experimental`. Returns undefined for
 * other sources (the regular entry points and gt-next), whose entries stay
 * unattributed.
 */
export function getLocaleTwinRegistrationImportSource(
  importSource: string
): string | undefined {
  switch (importSource) {
    case EXPERIMENTAL_IMPORT_SOURCES.GT_REACT:
    case EXPERIMENTAL_IMPORT_SOURCES.GT_TANSTACK_START:
      return importSource;
    case GT_IMPORT_SOURCES.GT_I18N:
      return 'gt-i18n/internal/experimental';
    default:
      return undefined;
  }
}

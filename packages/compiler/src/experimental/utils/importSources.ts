/** The `/experimental` GT entry points, which export the locale twin API. */
export const EXPERIMENTAL_IMPORT_SOURCES = {
  GT_REACT: 'gt-react/experimental',
  GT_TANSTACK_START: 'gt-tanstack-start/experimental',
} as const;

/** The compiler-injected registration function of a locale twin. */
export const LOCALE_TWIN_REGISTRATION_FUNCTION = 'GtInternalRegisterLocaleTwin';

/**
 * The import source for the locale twins registration call, given a GT import
 * source the module already uses: the `/experimental` entry points export it.
 * Returns undefined for other sources (the regular entry points, gt-i18n and
 * gt-next), whose translation functions read only whole-locale translations,
 * so their entries stay unattributed.
 */
export function getLocaleTwinRegistrationImportSource(
  importSource: string
): string | undefined {
  switch (importSource) {
    case EXPERIMENTAL_IMPORT_SOURCES.GT_REACT:
    case EXPERIMENTAL_IMPORT_SOURCES.GT_TANSTACK_START:
      return importSource;
    default:
      return undefined;
  }
}

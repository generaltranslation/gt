import { createGtNextDiagnostic } from './diagnostics';

// ========== WARNINGS ========== //

// This was (1) triggered by SSG without running middleware, or (2) triggered by a request with no locale headers (also no middleware).
export const noLocalesCouldBeDeterminedWarning = createGtNextDiagnostic({
  whatHappened: 'No locale could be determined for this request',
  wayOut: 'gt-next will fall back to the default locale',
  fix: 'If you use SSG, configure locale resolution',
  docsUrl:
    'https://generaltranslation.com/en/docs/next/guides/ssg#ssg-custom-get-locale',
});

export const withGTStaticPropsLocaleRoutingError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'withGTStaticProps() could not determine the statically generated locale',
  why: 'Without Pages Router locale routing, Next.js generates only one version of this page',
  fix: 'Add i18n locales and defaultLocale to your Next.js configuration',
});

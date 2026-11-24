import { createGtNextDiagnostic } from './diagnostics';

export const createWithGTStaticPropsClientError = () =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: 'withGTStaticProps() cannot run in the browser',
    why: 'static props are generated on the server by the Pages Router',
    fix: 'Export withGTStaticProps() from a Pages Router page module',
  });

export const createUnhashedClientTWarning = (text: string) =>
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened:
      'A <T> in a client component has no compile-time hash, so its translation can be missing from production builds with experimentalSplitTranslations when a server component renders the same content',
    fix: "Import T directly from 'gt-next' and write it as JSX, which the GT compiler hashes",
    details: `<T> content ${JSON.stringify(text)}`,
  });

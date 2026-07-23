import { createGtNextDiagnostic } from './diagnostics';

export const createWithGTStaticPropsClientError = () =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: 'withGTStaticProps() cannot run in the browser',
    why: 'Static props are generated on the server by the Pages Router',
    fix: 'Export withGTStaticProps() from a Pages Router page module',
  });

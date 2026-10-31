import { createGtNextDiagnostic } from './diagnostics';

export const createLocalePrefixedHrefWarning = (href: string, locale: string) =>
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened: `The href "${href}" already starts with the locale "${locale}" and was prefixed again`,
    why: 'Link and useLocalizeHref() expect unlocalized paths',
    fix: 'Pass the path without its locale prefix',
    wayOut: 'pass locale={false} to leave the href unchanged',
  });

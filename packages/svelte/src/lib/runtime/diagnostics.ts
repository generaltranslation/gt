import { createDiagnosticMessage } from 'generaltranslation/internal';

type GtSvelteDiagnosticInput = Omit<
  Parameters<typeof createDiagnosticMessage>[0],
  'source' | 'severity'
>;

export function createGtSvelteError(input: GtSvelteDiagnosticInput): string {
  return createDiagnosticMessage({
    source: 'gt-svelte',
    severity: 'Error',
    ...input,
  });
}

export function notCompiledDiagnostic(name: 'gt()' | '<T>'): string {
  return createGtSvelteError({
    whatHappened: `${name} ran without being compiled`,
    why: 'gt-svelte resolves translations at build time and only its Vite plugin can compile this call',
    fix: "Add gtSvelte() from 'gt-svelte/vite' before svelte() in the Vite plugins, and import gt and T directly from 'gt-svelte'",
  });
}

export const missingGTDiagnostic = createGtSvelteError({
  whatHappened: 'No gt-svelte runtime is available to this component',
  fix: 'Call setGT(createGT(...)) in a root component, pass gtContext(gt) as the mount or render context, or await initializeGT() before mounting in the browser',
});

export const moduleLookupDiagnostic = createGtSvelteError({
  whatHappened: 'gt() ran at module scope before the browser runtime was ready',
  why: 'module-level translations read the runtime created by initializeGT(), which exists only in the browser',
  fix: 'Await initializeGT() before importing modules that call gt() at module scope, or move the call into a component',
});

export const serverInitializeDiagnostic = createGtSvelteError({
  whatHappened: 'initializeGT() was called on the server',
  why: 'it stores one runtime for the whole page, which would be shared between requests',
  fix: 'Create one runtime per request with createGT() and provide it with setGT() or gtContext()',
});

export function unsupportedLocaleDiagnostic(locale: string): string {
  return createGtSvelteError({
    whatHappened: `The locale "${locale}" is not configured`,
    fix: 'Add it to the locales passed to createGT() or initializeGT()',
  });
}

export function missingLoaderDiagnostic(locale: string): string {
  return createGtSvelteError({
    whatHappened: `Translations for "${locale}" are not loaded and no loader is configured`,
    fix: 'Pass loadTranslations to createGT() or preload the catalog with the translations option',
  });
}

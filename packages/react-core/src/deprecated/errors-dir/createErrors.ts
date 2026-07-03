import { getLocaleProperties } from "@generaltranslation/format";
import {
  createReactCoreDiagnostic,
  formatDiagnosticErrorDetails,
} from "./diagnostics";
import { PACKAGE_NAME } from "./constants";

// ---- ERRORS ---- //

export const projectIdMissingError = createReactCoreDiagnostic({
  severity: "Error",
  whatHappened: "Runtime translation needs a project ID",
  fix: "Add projectId to your <GTProvider> configuration or set GT_PROJECT_ID in your environment",
  docsUrl: "https://generaltranslation.com/dashboard",
});

export const devApiKeyProductionError = createReactCoreDiagnostic({
  severity: "Error",
  whatHappened: "Production environments cannot use a development API key",
  fix: "Replace it with a production API key before deploying",
});

export const apiKeyInProductionError = createReactCoreDiagnostic({
  severity: "Error",
  whatHappened: "The API key is available to client-side production code",
  fix: "Move translation credentials to a server-only environment before deploying",
});

export const createNoAuthError = createReactCoreDiagnostic({
  severity: "Error",
  whatHappened: "Runtime translation is not configured",
  fix: "Add projectId and devApiKey to your environment, or pass them to <GTProvider> directly",
});

export const createPluralMissingError = (children: unknown) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `<Plural> could not choose a plural form for "${children}"`,
    fix: 'Pass the required "n" option to <Plural>',
  });

export const createClientSideTDictionaryCollisionError = (id: string) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `<T id="${id}"> conflicts with a dictionary entry using the same ID`,
    fix: "Rename the <T> id or the dictionary key so each translation source has a unique ID",
  });

export const createClientSideTHydrationError = (id: string) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `<T id="${id}"> is rendering in a client component without a saved translation`,
    why: "This can cause hydration mismatches",
    fix: "Use a dictionary with useGT() or push translations from the command line before rendering this component on the client",
  });

export const dynamicTranslationError = createReactCoreDiagnostic({
  severity: "Error",
  whatHappened: "Runtime translations could not be loaded",
  wayOut: "Source content will render as a fallback",
  fix: "Check your runtime translation configuration and try again",
});

export const createGenericRuntimeTranslationError = (
  id: string | undefined,
  hash: string,
  error?: unknown,
) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: id
      ? `Translation could not be found for id "${id}" and hash "${hash}"`
      : `Translation could not be found for hash "${hash}"`,
    wayOut: "Source content will render as a fallback",
    fix: "Push translations again or check that runtime translation is configured",
    details: formatDiagnosticErrorDetails(error),
  });

export const runtimeTranslationError = createReactCoreDiagnostic({
  severity: "Error",
  whatHappened: "Runtime translation could not be completed",
});

export const customLoadTranslationsError = (locale: string = "") =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `Locally stored translations could not be loaded${locale ? ` for "${locale}"` : ""}`,
    fix: "If you use loadTranslations(), make sure it returns translations for the requested locale",
  });

export const customLoadDictionaryWarning = (locale: string = "") =>
  createReactCoreDiagnostic({
    severity: "Warning",
    whatHappened: `The local dictionary could not be loaded${locale ? ` for "${locale}"` : ""}`,
    fix: "If you use loadDictionary(), make sure it returns a dictionary for the requested locale",
  });

export const missingVariablesError = (variables: string[], message: string) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `The message "${message}" is missing variables: "${variables.join('", "')}"`,
    fix: "Provide values for these variables before rendering the translation",
  });

export const createStringRenderError = (
  message: string,
  id: string | undefined,
  error?: unknown,
) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `The string ${id ? `for id "${id}" ` : ""}could not be rendered`,
    fix: `Check the message syntax and variables for: "${message}"`,
    details: formatDiagnosticErrorDetails(error),
  });

export const createStringTranslationError = (
  string: string,
  id?: string,
  functionName = "tx",
) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `${functionName}("${string}")${id ? ` with id "${id}"` : ""} could not find a translation`,
    wayOut: "Source content will render as a fallback",
    fix: "Push translations again or check your dictionary/runtime translation configuration",
  });

export const invalidLocalesError = (locales: string[]) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: "Invalid locale codes in your configuration",
    fix: 'Specify a list of valid locales or use "customMapping" to define aliases for the invalid locales',
    details: locales,
  });

export const invalidCanonicalLocalesError = (locales: string[]) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: "Invalid canonical locale codes in your configuration",
    fix: "Use valid BCP 47 locale codes before starting translation",
    details: locales,
  });

export const createEmptyIdError = () =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: "t.obj() received an empty id",
    fix: "Pass a non-empty dictionary id",
  });

export const createSubtreeNotFoundError = (id: string) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `Dictionary subtree "${id}" could not be found`,
    fix: "Check that the id matches your dictionary structure",
  });

export const createDictionaryEntryError = () =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: "A dictionary entry cannot be injected as a subtree",
    fix: "Pass a dictionary object instead",
  });

export const createCannotInjectDictionaryEntryError = () =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened:
      "A dictionary entry cannot be merged into another dictionary entry",
    fix: "Pass a dictionary subtree instead",
  });

export const createInvalidIcuDictionaryEntryError = (id: string | undefined) =>
  createReactCoreDiagnostic({
    severity: "Error",
    whatHappened: `Dictionary entry "${id}" contains invalid ICU syntax`,
    fix: "Fix the ICU message before rendering this translation",
  });

// ---- WARNINGS ---- //

export const projectIdMissingWarning = createReactCoreDiagnostic({
  severity: "Warning",
  whatHappened: "Runtime translation needs a project ID",
  fix: "Add projectId to <GTProvider> or set GT_PROJECT_ID in your environment",
  docsUrl: "https://generaltranslation.com/dashboard",
});

export const createNoEntryFoundWarning = (id: string) =>
  createReactCoreDiagnostic({
    severity: "Warning",
    whatHappened: `No valid dictionary entry was found for id "${id}"`,
    wayOut: "Source content will render as a fallback",
  });

export const createInvalidDictionaryEntryWarning = (id: string) =>
  createReactCoreDiagnostic({
    severity: "Warning",
    whatHappened: `Dictionary entry "${id}" is invalid`,
    wayOut: "Source content will render as a fallback until the entry is fixed",
  });

export const createInvalidIcuDictionaryEntryWarning = (id: string) =>
  createReactCoreDiagnostic({
    severity: "Warning",
    whatHappened: `Dictionary entry "${id}" contains invalid ICU syntax`,
    wayOut: "Source content will render as a fallback until the entry is fixed",
  });

export const createNoEntryTranslationWarning = (
  id: string,
  prefixedId: string,
) =>
  createReactCoreDiagnostic({
    severity: "Warning",
    whatHappened: `t("${id}") could not find a translation for dictionary item "${prefixedId}"`,
    wayOut: "Source content will render as a fallback",
  });

export const createMismatchingHashWarning = (
  expectedHash: string,
  receivedHash: string,
) =>
  createReactCoreDiagnostic({
    severity: "Warning",
    whatHappened: "Translation hashes do not match",
    reassurance: "The translation will still render",
    fix: "Update your translations to the newest version to avoid stale content",
    details: [`expected ${expectedHash}`, `received ${receivedHash}`],
  });

export const APIKeyMissingWarn = createReactCoreDiagnostic({
  severity: "Warning",
  whatHappened: "Runtime translation needs a development API key",
  fix: "Find your development API key at generaltranslation.com/dashboard, or set runtimeUrl to an empty string to disable runtime translation",
});

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `${PACKAGE_NAME} Warning: The following locales are currently unsupported by our service: ${locales
    .map((locale) => {
      const { name } = getLocaleProperties(locale);
      return `${locale} (${name})`;
    })
    .join(", ")}`;

export const runtimeTranslationTimeoutWarning = createReactCoreDiagnostic({
  severity: "Warning",
  whatHappened: "Runtime translation timed out",
});

export const createUnsupportedLocaleWarning = (
  validatedLocale: string,
  newLocale: string,
  packageName: string = PACKAGE_NAME,
) => {
  return (
    `${packageName} Warning: "${newLocale}" is not a supported locale. ` +
    `Update supported locales in your dashboard or gt.config.json. ` +
    `Falling back to "${validatedLocale}".`
  );
};

export const dictionaryMissingWarning = createReactCoreDiagnostic({
  severity: "Warning",
  whatHappened: "No dictionary was found",
  fix: "Pass a dictionary to <GTProvider> or configure a dictionary loader before rendering translations",
});

export const createStringRenderWarning = (
  message: string,
  id: string | undefined,
  error?: unknown,
) =>
  createReactCoreDiagnostic({
    severity: "Warning",
    whatHappened: `The string ${id ? `for id "${id}" ` : ""}could not be rendered`,
    wayOut: "Source content will render as a fallback",
    fix: `Check the message syntax and variables for: "${message}"`,
    details: formatDiagnosticErrorDetails(error),
  });

// Unlikely edge case: A <_T> component was injected outside of a <Derive> boundary. This would be caused by the compiler overeagerly injecting <_T> components.
export const warnNestedInternalTComponent = `${PACKAGE_NAME} Warning: A <_T> component was found injected outside of a <Derive> boundary. This may affect translation resolution for this component.`;

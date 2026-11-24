import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { SELECT_COMPONENT } from '../react/jsx/utils/constants.js';
import {
  colorizeFilepath,
  colorizeComponent,
  colorizeIdString,
  colorizeContent,
  colorizeLine,
  colorizeFunctionName,
} from './colors.js';
import { formatCodeClamp } from './formatting.js';
import { ApiError, ErrorCode } from '@generaltranslation/api';
import { defaultDashboardUrl } from 'generaltranslation/internal';

const withWillErrorInNextVersion = (message: string): string =>
  `${message} (This will become an error in the next major version of the CLI.)`;

// Derive function related errors
const withDeriveComponentError = (message: string): string =>
  `<Derive> rules violation: ${message}`;

const withDeriveFunctionError = (message: string): string =>
  `derive() rules violation: ${message}`;

export const warnVariablePropSync = (
  file: string,
  attrName: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `${colorizeComponent('<T>')} component has dynamic attribute ${colorizeIdString(attrName)} with value: ${colorizeContent(
      value
    )}. Change ${colorizeIdString(attrName)} to ensure this content is translated.`,
    location
  );

export const warnInvalidReturnSync = (
  file: string,
  functionName: string,
  expression: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveComponentError(
      `Function ${colorizeFunctionName(functionName)} does not return a derivable (statically analyzable) expression. ${colorizeFunctionName(functionName)} must return either (1) a derivable string literal, (2) another derivable function invocation, (3) derivable JSX content, or (4) a ternary expression. Instead got:\n${colorizeContent(expression)}`
    ),
    location
  );

// TODO: this is temporary until we handle implicit returns
export const warnMissingReturnSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    `Function ${colorizeFunctionName(functionName)} is wrapped in ${colorizeComponent('<Derive>')} tags but does not have an explicit return statement. Derivable functions must have an explicit return statement.`,
    location
  );

export const warnHasUnwrappedExpressionSync = (
  file: string,
  unwrappedExpressions: string[],
  id?: string,
  location?: string
): string =>
  withLocation(
    file,
    `${colorizeComponent('<T>')} component${
      id ? ` with id ${colorizeIdString(id)}` : ''
    } has children that could change at runtime. Use a variable component like ${colorizeComponent(
      '<Var>'
    )} to ensure this content is translated.\n${colorizeContent(
      unwrappedExpressions.join('\n')
    )}`,
    location
  );

export const warnFailedToConstructJsxTreeSync = (
  file: string,
  code: string,
  location?: string
): string =>
  withLocation(
    file,
    `Failed to construct JsxTree! Call expression is not a valid createElement call: ${colorizeContent(code)}`,
    location
  );

export const warnNestedTComponent = (file: string, location?: string): string =>
  withLocation(
    file,
    `Found nested <T> component. <T> components cannot be directly nested.`,
    location
  );

export const warnNestedInternalTComponent = (
  file: string,
  location?: string
): string =>
  withLocation(
    file,
    `DEBUG: Found nested <GtInternalTranslateJsx> component. <GtInternalTranslateJsx> components cannot be directly nested.`,
    location
  );

export const warnInvalidMaxCharsSync = (
  file: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `Found invalid maxChars value: ${colorizeContent(value)}. maxChars must be a numeric literal, e.g. maxChars={10}, to ensure this content is translated.`,
    location
  );

export const warnNonStaticMessageTreeSync = (
  file: string,
  reason: string,
  location?: string,
  details?: string,
  fix = 'Use static text, ${{ name }} variables, helpers with literal arguments, and literal t({ ... }) options so the message can be extracted and translated'
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: 'Skipped a tagged-template message',
      why: reason,
      details,
      fix,
    }),
    location
  );

export const warnUntrackedMessageTagSync = (
  file: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened:
        'Could not follow this use of a translation function (t, msg, useGT, or getGT)',
      why: 'it is exported, reassigned, accessed as an object, or passed somewhere that cannot be followed, so the messages it translates cannot be found statically',
      fix: 'Call it directly (as a tagged template for t), alias it with const, or pass the t from useGT() or getGT() to a plain, non-destructured parameter of a function in your project',
    }),
    location
  );

export const warnStringMessageCallSync = (
  file: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: 'Skipped a string call of a translation function',
      why: 'messages are tagged templates, so a string argument is not extracted',
      fix: 'Write the message as a tagged template, as in t`Hello, ${{ name }}!`',
    }),
    location
  );

export const warnNonLiteralMsgCallSync = (
  file: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: 'Skipped a msg() call',
      why: 'its argument is not a single string literal, so the message cannot be extracted',
      fix: "Pass a string literal, as in msg('Save'), or write the message as a tagged msg`...` template",
    }),
    location
  );

export const warnUnfollowedMessageImportSync = (
  file: string,
  source: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: `Could not extract tagged-template messages that use ${source} through require(), import(), a namespace import, or a re-export`,
      why: 'only named imports are followed',
      fix: `Import t, msg, useGT, or getGT by name from '${source}' in each file that translates`,
    }),
    location
  );

export const warnIgnoredProtoPropertySync = (
  file: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: 'Ignored a __proto__ property in a tagged-template message',
      why: 'a non-computed __proto__ key sets the object prototype instead of adding a branch or option',
      fix: "Use a computed ['__proto__'] key to add a branch with that name, or remove the property",
    }),
    location
  );

export const warnInvalidRequiresReviewSync = (
  file: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `Found invalid requiresReview value: ${colorizeContent(value)}. Must be a boolean literal (true or false) — strings and dynamic expressions are not allowed.`,
    location
  );

export const warnInvalidIcuSync = (
  file: string,
  value: string,
  error: string,
  location?: string
): string =>
  withWillErrorInNextVersion(
    withLocation(
      file,
      `Found invalid ICU string: ${colorizeContent(value)}. Change the value to a valid ICU to ensure this content is translated. Error message: ${error}.`,
      location
    )
  );

export const warnTernarySync = (file: string, location?: string): string =>
  withLocation(
    file,
    'Found ternary expression. A Select component may be more appropriate here.',
    location
  );

export const withLocation = (
  file: string,
  message: string,
  location?: string
): string =>
  `${colorizeFilepath(file)}${location ? ` (${colorizeLine(location)})` : ''}: ${message}`;

export const warnFunctionNotFoundSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    `Function ${colorizeFunctionName(functionName)} definition could not be resolved. This might affect translation resolution for this ${colorizeComponent('<T>')} component.`,
    location
  );

export const warnDuplicateFunctionDefinitionSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    `Function ${colorizeFunctionName(functionName)} is defined multiple times. Only the first definition will be used.`,
    location
  );

export const warnInvalidDeriveInitSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveComponentError(
      `The definition for ${colorizeFunctionName(functionName)} could not be resolved. When using arrow syntax to define a derivable (statically analyzable) function, the right hand side or the assignment MUST only contain the arrow function itself and no other expressions.
Example: ${colorizeContent(`const ${colorizeFunctionName(functionName)} = () => { ... }`)}
Invalid: ${colorizeContent(`const ${colorizeFunctionName(functionName)} = [() => { ... }][0]`)}`
    ),
    location
  );

export const warnDataAttrOnBranch = (
  file: string,
  attrName: string,
  location?: string
): string =>
  withLocation(
    file,
    `${colorizeComponent(`<${SELECT_COMPONENT}>`)} component ignores attributes prefixed with ${colorizeIdString('"data-"')}. Found ${colorizeIdString(attrName)}. Remove it or use a different attribute name.`,
    location
  );

export const warnBranchOtherPropSync = (
  file: string,
  componentName: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: `<${componentName}> has no other prop`,
      fix: 'Write the fallback as its children',
    }),
    location
  );

export const warnInvalidExactPluralPropSync = (
  file: string,
  componentName: string,
  attrName: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: `Ignored the ${attrName} prop of <${componentName}>`,
      why: 'it is not an exact number',
      fix: 'Write the number without a leading zero or an exponent, as in _0 or _1000',
    }),
    location
  );

export const warnSpreadOnBranchSync = (
  file: string,
  componentName: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: `<${componentName}> cannot take a spread attribute`,
      why: 'its props are read from the source',
      fix: 'Write each prop out on the component',
    }),
    location
  );

export const warnRecursiveFunctionCallSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveComponentError(
      `Recursive function call detected: ${colorizeFunctionName(functionName)}. A derivable (statically analyzable) function cannot use recursive calls to construct its result.`
    ),
    location
  );

export const warnDeriveFunctionNotWrappedSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveFunctionError(
      `Could not resolve ${colorizeFunctionName(formatCodeClamp(functionName))}. This call is not wrapped in derive(). Ensure the function is properly wrapped with derive() and does not have circular import dependencies.`
    ),
    location
  );

export const warnDeriveContextNotWholeSync = (
  file: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    createDiagnosticMessage({
      whatHappened: `Skipped a ${colorizeComponent('<T>')} whose context wraps derive() in another expression`,
      why: `${colorizeComponent('<T>')} reads derive() only as its whole context`,
      fix: 'Pass one derive() call as the context, and return the full text from the function it calls',
      details: colorizeContent(value),
    }),
    location
  );

export const warnDeriveNonConstVariableSync = (
  file: string,
  varName: string,
  kind: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveFunctionError(
      `Variable ${colorizeFunctionName(varName)} is declared with '${kind}' but only 'const' declarations can be resolved statically. Change it to 'const'.`
    ),
    location
  );

export const warnDeriveFunctionNoResultsSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveFunctionError(
      `Could not resolve ${colorizeFunctionName(formatCodeClamp(functionName))}. derive() takes a call to a function that returns string literals, a const, or a conditional of them, and cannot use undefined values or looped calls to construct its result.`
    ),
    location
  );

export const warnDeriveUnresolvableValueSync = (
  file: string,
  key: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveFunctionError(
      `Object property ${colorizeFunctionName(formatCodeClamp(key))} could not be resolved to a static string value. Only string literals, template literals, conditionals, and function calls returning strings are supported.`
    ),
    location
  );

export const warnDeriveCircularSpreadSync = (
  file: string,
  varName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveFunctionError(
      `Circular spread detected involving ${colorizeFunctionName(varName)}. Spread references that form a cycle cannot be resolved statically.`
    ),
    location
  );

export const warnDeriveDestructuringSync = (
  file: string,
  varName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveFunctionError(
      `Variable ${colorizeFunctionName(varName)} uses destructuring syntax, which is not yet supported in derive(). Assign the value to a const variable directly instead.`
    ),
    location
  );

export const warnDeriveOptionalChainingSync = (
  file: string,
  code: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeriveFunctionError(
      `Optional chaining (${colorizeFunctionName(formatCodeClamp(code))}) is not supported in derive(). Optional chaining implies the value could be undefined, which cannot be resolved statically. Use a non-optional access instead.`
    ),
    location
  );

// Re-export error messages
export const noLocalesError = `No target locales were found. Add locales to gt.config.json or pass them with the --locales flag.`;
export const noDefaultLocaleError = `No default locale was found. Add defaultLocale to gt.config.json or pass it with --default-locale.`;
export const noFilesError = `The files configuration is missing or invalid. Check the files section in gt.config.json and try again.`;
export const outdatedTranslationFilesError = (files: string[]): string =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: 'Translation files are out of date with the source code',
    fix: 'Run `gt generate` and commit the changes',
    details: files,
  });
export const unreadableTranslationFileError = (file: string): string =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: `${file} could not be read as JSON`,
    reassurance: 'Nothing was written',
    fix: 'Check that the file can be read and holds valid JSON, then run `gt generate` again',
  });
export const noSourceFileError = `No source translation file was found. Check your translations directory and default locale configuration.`;
// TODO: add a CLI command that finds or creates a project for the signed-in
// user and prints its ID (e.g. `gt project list`), and name it in this error.
export const noProjectIdError = (dashboardUrl: string): string =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: 'No project ID was found',
    fix: 'Pass --project-id, add projectId to gt.config.json, or set the GT_PROJECT_ID environment variable',
    wayOut: `Find your project ID, or create a project, in the dashboard (${dashboardUrl})`,
  });
export const noVersionIdError = `No version ID was found. Pass --version-id or add _versionId to gt.config.json.`;
export const invalidConfigurationError = `The files configuration cannot be used for this operation. Provide a valid download configuration or set --publish true to upload translations to the CDN.`;
export const lottieTranslateError = `Lottie translations are processed asynchronously, so the translate command cannot complete them in one run. Use the stage and download flow instead:\n  1. Stage the files for translation: npx gt stage\n  2. Fetch the finished translations: npx gt download\nTranslations that are still processing are skipped, so re-run npx gt download until all of them have been downloaded.`;
export const branchResolutionError = `The current git branch could not be resolved. Specify a branch explicitly or run the command from a git worktree with branch metadata available.`;

export const lottieExpressionsError = (files: string[]): string =>
  `The following Lottie file(s) use After Effects expressions, which contain executable code and are not supported yet:\n${files
    .map((file) => `  - ${file}`)
    .join(
      '\n'
    )}\nRe-export the animation with expressions baked into keyframes (or removed), then try again.`;

export const xcstringsSourceLanguageMismatchError = (
  catalogs: { file: string; sourceLanguage: string }[],
  defaultLocale: string
): string =>
  `The following .xcstrings catalog(s) declare a sourceLanguage that does not match the configured defaultLocale "${defaultLocale}":\n${catalogs
    .map(
      ({ file, sourceLanguage }) =>
        `  - ${file} (sourceLanguage "${sourceLanguage}")`
    )
    .join(
      '\n'
    )}\nSet defaultLocale in gt.config.json to the catalog's sourceLanguage, or change the catalog's source language in Xcode, then try again.`;

export const fileEncodingSkipReason = (error: unknown): string =>
  `File could not be decoded: ${error instanceof Error ? error.message : String(error)}`;

const dashboardHint = (task: string) =>
  `Open the dashboard ${defaultDashboardUrl} to ${task}.`;

/** A short fix for an API failure whose code has one; the server message stays the detail. */
export function describeApiError(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.code) {
    case ErrorCode.PAYMENT_REQUIRED:
    case ErrorCode.USAGE_LIMIT_REACHED:
    case ErrorCode.SPEND_LIMIT_REACHED:
    case ErrorCode.CREDITS_INSUFFICIENT:
      return dashboardHint('manage billing');
    case ErrorCode.UNAUTHENTICATED:
    case ErrorCode.API_KEY_INVALID:
    case ErrorCode.TOKEN_INVALID:
      return 'Check GT_API_KEY, or run `gt login` to sign in again.';
    case ErrorCode.SCOPE_MISSING:
      return 'Run `gt login` to sign in again with the required access.';
    case ErrorCode.PERMISSION_MISSING:
      return 'Use an API key or account with the permission named in the error.';
    case ErrorCode.LOCALE_NOT_ALLOWED:
    case ErrorCode.TARGET_LOCALES_MISSING:
      return dashboardHint('enable the locales in your project settings');
    case ErrorCode.PLAN_FEATURE_UNAVAILABLE:
      return dashboardHint('upgrade your plan');
    case ErrorCode.PROJECT_LIMIT_REACHED:
      return dashboardHint('delete an unused project or upgrade your plan');
    case ErrorCode.CDN_NOT_ENABLED:
      return dashboardHint('enable the CDN for your project');
    case ErrorCode.RATE_LIMITED:
      return 'Wait a moment, then try again.';
    default:
      return undefined;
  }
}

/** A failed workflow: what happened, the API error's fix or a generic one, and the original error. */
export const workflowFailureMessage = (
  whatHappened: string,
  error: unknown
): string =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened,
    fix:
      describeApiError(error) ??
      'Check the files, branch configuration, and API credentials, then try again.',
    details: formatDiagnosticErrorDetails(error),
  });

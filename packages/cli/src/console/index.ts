import { BRANCH_COMPONENT } from '../react/jsx/utils/constants.js';
import {
  colorizeFilepath,
  colorizeComponent,
  colorizeIdString,
  colorizeContent,
  colorizeLine,
  colorizeFunctionName,
} from './colors.js';
import { formatCodeClamp } from './formatting.js';

const withWillErrorInNextVersion = (message: string): string =>
  `${message} (This will become an error in the next major version of the CLI.)`;

// Derive function related errors
const withDeriveComponentError = (message: string): string =>
  `<Derive> rules violation: ${message}`;

const withDeriveFunctionError = (message: string): string =>
  `derive() rules violation: ${message}`;
// Synchronous wrappers for backward compatibility
export const warnApiKeyInConfigSync = (optionsFilepath: string): string =>
  `${colorizeFilepath(
    optionsFilepath
  )}: Your API key is exposed! Remove it from the file and include it as an environment variable.`;

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
    `Function ${colorizeFunctionName(functionName)} is wrapped in ${colorizeComponent('<Derive>')} (formerly ${colorizeComponent('<Static>')}) tags but does not have an explicit return statement. Derivable functions must have an explicit return statement.`,
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

export const warnNonStaticExpressionSync = (
  file: string,
  attrName: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `Found non-static expression for attribute ${colorizeIdString(
      attrName
    )}: ${colorizeContent(value)}. Change "${colorizeIdString(attrName)}" to ensure this content is translated.`,
    location
  );

export const warnInvalidMaxCharsSync = (
  file: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `Found invalid maxChars value: ${colorizeContent(value)}. Change the value to a valid number to ensure this content is translated.`,
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

export const warnTemplateLiteralSync = (
  file: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `Found template literal with quasis (${colorizeContent(value)}). Change the template literal to a string to ensure this content is translated.`,
    location
  );

export const warnNonStringSync = (
  file: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `Found non-string literal (${colorizeContent(value)}). Change the value to a string literal to ensure this content is translated.`,
    location
  );

export const warnAsyncUseGT = (file: string, location?: string): string =>
  withLocation(
    file,
    `Found useGT() in an async function. Use getGT() instead, or make the function synchronous.`,
    location
  );

export const warnSyncGetGT = (file: string, location?: string): string =>
  withLocation(
    file,
    `Found getGT() in a synchronous function. Use useGT() instead, or make the function async.`,
    location
  );

export const warnTernarySync = (file: string, location?: string): string =>
  withLocation(
    file,
    'Found ternary expression. A Branch component may be more appropriate here.',
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

export const warnInvalidDeclareVarNameSync = (
  file: string,
  value: string,
  location?: string
): string =>
  withLocation(
    file,
    `Found invalid declareVar() $name tag. Must be a derivable (statically analyzable) expression. Received: ${colorizeContent(value)}.`,
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
    `${colorizeComponent(`<${BRANCH_COMPONENT}>`)} component ignores attributes prefixed with ${colorizeIdString('"data-"')}. Found ${colorizeIdString(attrName)}. Remove it or use a different attribute name.`,
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
      `Could not resolve ${colorizeFunctionName(formatCodeClamp(functionName))}. This call is not wrapped in derive() (formerly declareStatic()). Ensure the function is properly wrapped with derive() and does not have circular import dependencies.`
    ),
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
      `Could not resolve ${colorizeFunctionName(formatCodeClamp(functionName))}. derive() (formerly declareStatic()) can only receive function invocations and cannot use undefined values or looped calls to construct its result.`
    ),
    location
  );

export const warnAutoDeriveNoResultsSync = (
  file: string,
  expression: string,
  location?: string
): string =>
  withLocation(
    file,
    `Auto-derive could not resolve ${colorizeFunctionName(formatCodeClamp(expression))}. Only function calls with statically determinable return values can be used directly in t(). Consider wrapping with derive() for explicit derivation, or use an interpolation variable instead.`,
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
export const noLocalesError = `No locales found! Provide a list of locales for translation, or specify them in your gt.config.json file.`;
export const noDefaultLocaleError = `No default locale found! Provide a default locale, or specify it in your gt.config.json file.`;
export const noFilesError = `Incorrect or missing files configuration! Make sure your files are configured correctly in your gt.config.json file.`;
export const noSourceFileError = `No source file found! Double-check your translations directory and default locale.`;
export const noSupportedFormatError = `Unsupported data format! Make sure your translationsDir parameter ends with a supported file extension.`;
export const noApiKeyError = `No API key found! Provide an API key using the --api-key flag or set the GT_API_KEY environment variable.`;
export const devApiKeyError = `Development API keys cannot be used with the General Translation API. Use a production API key instead.\nGenerate a production API key with: npx gt auth -t production`;
export const noProjectIdError = `No project ID found! Provide a project ID using the --project-id flag, specify it in your gt.config.json file, or set the GT_PROJECT_ID environment variable.`;
export const noVersionIdError = `No version ID found! Provide a version ID using the --version-id flag or specify it in your gt.config.json file as the _versionId property.`;
export const invalidConfigurationError = `Invalid files configuration! Provide a valid configuration to download local translations or set the --publish flag to true to upload translations to the CDN.`;

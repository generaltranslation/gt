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

// Static function related errors
const withStaticError = (message: string): string =>
  `<Static> rules violation: ${message}`;

const withDeclareStaticError = (message: string): string =>
  `declareStatic() rules violation: ${message}`;
// Synchronous wrappers for backward compatibility
export const warnApiKeyInConfigSync = (optionsFilepath: string): string =>
  `${colorizeFilepath(
    optionsFilepath
  )}: Your API key is exposed! Please remove it from the file and include it as an environment variable.`;

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
    withStaticError(
      `Function ${colorizeFunctionName(functionName)} does not return a static expression. ${colorizeFunctionName(functionName)} must return either (1) a static string literal, (2) another static function invocation, (3) static JSX content, or (4) a ternary expression. Instead got:\n${colorizeContent(expression)}`
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
    `Function ${colorizeFunctionName(functionName)} is wrapped in ${colorizeComponent('<Static>')} tags but does have an explicit return statement. Static functions must have an explicit return statment.`,
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
    `Found invalid declareVar() $name tag. Must be a static expression. Received: ${colorizeContent(value)}.`,
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

export const warnInvalidStaticInitSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withStaticError(
      `The definition for ${colorizeFunctionName(functionName)} could not be resolved. When using arrow syntax to define a static function, the right hand side or the assignment MUST only contain the arrow function itself and no other expressions.
Example: ${colorizeContent(`const ${colorizeFunctionName(functionName)} = () => { ... }`)}
Invalid: ${colorizeContent(`const ${colorizeFunctionName(functionName)} = [() => { ... }][0]`)}`
    ),
    location
  );

export const warnRecursiveFunctionCallSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withStaticError(
      `Recursive function call detected: ${colorizeFunctionName(functionName)}. A static function cannot use recursive calls to construct its result.`
    ),
    location
  );

export const warnDeclareStaticNotWrappedSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeclareStaticError(
      `Could not resolve ${colorizeFunctionName(formatCodeClamp(functionName))}. This call is not wrapped in declareStatic(). Ensure the function is properly wrapped with declareStatic() and does not have circular import dependencies.`
    ),
    location
  );

export const warnDeclareStaticNoResultsSync = (
  file: string,
  functionName: string,
  location?: string
): string =>
  withLocation(
    file,
    withDeclareStaticError(
      `Could not resolve ${colorizeFunctionName(formatCodeClamp(functionName))}. DeclareStatic can only receive function invocations and cannot use undefined values or looped calls to construct its result.`
    ),
    location
  );

// Re-export error messages
export const noLocalesError = `No locales found! Please provide a list of locales for translation, or specify them in your gt.config.json file.`;
export const noDefaultLocaleError = `No default locale found! Please provide a default locale, or specify it in your gt.config.json file.`;
export const noFilesError = `Incorrect or missing files configuration! Please make sure your files are configured correctly in your gt.config.json file.`;
export const noSourceFileError = `No source file found! Please double check your translations directory and default locale.`;
export const noSupportedFormatError = `Unsupported data format! Please make sure your translationsDir parameter ends with a supported file extension.`;
export const noApiKeyError = `No API key found! Please provide an API key using the --api-key flag or set the GT_API_KEY environment variable.`;
export const devApiKeyError = `You are using a development API key. Please use a production API key to use the General Translation API.\nYou can generate a production API key with the command: npx gtx-cli auth -t production`;
export const noProjectIdError = `No project ID found! Please provide a project ID using the --project-id flag, specify it in your gt.config.json file, or set the GT_PROJECT_ID environment variable.`;
export const noVersionIdError = `No version ID found! Please provide a version ID using the --version-id flag or specify it in your gt.config.json file as the _versionId property.`;
export const invalidConfigurationError = `Invalid files configuration! Please either provide a valid configuration to download local translations or set the --publish flag to true to upload translations to the CDN.`;

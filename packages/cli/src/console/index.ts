import {
  colorizeFilepath,
  colorizeComponent,
  colorizeIdString,
  colorizeContent,
  colorizeLine,
} from './colors.js';

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

// Re-export error messages
export const noLocalesError = `No locales found! Please provide a list of locales to translate to, or specify them in your gt.config.json file.`;
export const noDefaultLocaleError = `No default locale found! Please provide a default locale, or specify it in your gt.config.json file.`;
export const noFilesError = `Incorrect or missing files configuration! Please make sure your files are configured correctly in your gt.config.json file.`;
export const noSourceFileError = `No source file found! Please double check your translations directory and default locale.`;
export const noSupportedFormatError = `Unsupported data format! Please make sure your translationsDir parameter ends with a supported file extension.`;
export const noApiKeyError = `No API key found! Please provide an API key using the --api-key flag or set the GT_API_KEY environment variable.`;
export const devApiKeyError = `You are using a development API key. Please use a production API key to use the General Translation API.\nYou can generate a production API key with the command: npx gtx-cli auth -t production`;
export const noProjectIdError = `No project ID found! Please provide a project ID using the --project-id flag, specify it in your gt.config.json file, or set the GT_PROJECT_ID environment variable.`;
export const noVersionIdError = `No version ID found! Please provide a version ID using the --version-id flag or specify it in your gt.config.json file as the _versionId property.`;

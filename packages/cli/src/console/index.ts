// Export all logging functions
export * from './logging';

// Synchronous wrappers for backward compatibility 
export const warnApiKeyInConfigSync = (optionsFilepath: string): string => 
  `Found apiKey in "${optionsFilepath}". Your API key is exposed! Please remove it from the file and include it as an environment variable.`;

export const warnVariablePropSync = (file: string, attrName: string, value: string): string =>
  `Found <T> component in ${file} with variable ${attrName}: "${value}". Change "${attrName}" to ensure this content is translated.`;

export const warnNoIdSync = (file: string): string =>
  `Found <T> component in ${file} with no id. Add an id to ensure the content is translated.`;

export const warnHasUnwrappedExpressionSync = (file: string, id: string, unwrappedExpressions: string[]): string =>
  `<T> with id "${id}" in ${file} has children: ${unwrappedExpressions.join(', ')} that could change at runtime. Use a variable component like <Var> to translate this properly.`;

export const warnNonStaticExpressionSync = (file: string, attrName: string, value: string): string =>
  `Found non-static expression in ${file} for attribute ${attrName}: "${value}". Change "${attrName}" to ensure this content is translated.`;

export const warnTemplateLiteralSync = (file: string, value: string): string =>
  `Found template literal with quasis (${value}) in ${file}. Change the template literal to a string to ensure this content is translated.`;

export const warnTernarySync = (file: string): string =>
  `Found ternary expression in ${file}. A Branch component may be more appropriate here.`;

// Re-export error messages
export const noLocalesError = `No locales found! Please provide a list of locales to translate to, or specify them in your gt.config.json file.`;
export const noDefaultLocaleError = `No default locale found! Please provide a default locale, or specify it in your gt.config.json file.`;
export const noFilesError = `Incorrect or missing files configuration! Please make sure your files are configured correctly in your gt.config.json file.`;
export const noSourceFileError = `No source file found! Please double check your translations directory and default locale.`;
export const noDataFormatError = `No data format found! Please make sure your translationsDir parameter ends with a supported file extension.`;
export const noSupportedDataFormatError = `Unsupported data format! Please make sure your translationsDir parameter ends with a supported file extension.`;
export const noApiKeyError = `No API key found! Please provide an API key using the --api-key flag or set the GT_API_KEY environment variable.`;
export const noProjectIdError = `No project ID found! Please provide a project ID using the --project-id flag, specify it in your gt.config.json file, or set the GT_PROJECT_ID environment variable.`;
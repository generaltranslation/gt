import {
  text,
  select,
  confirm,
  isCancel,
  cancel,
  multiselect,
  autocomplete,
  autocompleteMultiselect,
} from '@clack/prompts';
import type { Option } from '@clack/prompts';
import chalk from 'chalk';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { getCLIVersion } from '../utils/packageJson.js';
import { logger } from './logger.js';
import { TEMPLATE_FILE_NAME } from '../utils/constants.js';
import type { CustomMapping, FileToUpload } from 'generaltranslation/types';
import { parseTypedLocale } from './promptParsing.js';
import { getFilteredLocaleOptions } from './localeOptions.js';
import {
  getInlineElementsLabel,
  type InlineLibrary,
} from '../types/libraries.js';

function exitIfCancelled<T>(
  result: T | symbol,
  message = 'Operation cancelled'
): T {
  if (isCancel(result)) {
    cancel(message);
    return exitSync(0);
  }
  return result as T;
}

/**
 * Strip ANSI escape codes from a string (e.g., chalk color codes)
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex, no-useless-escape
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

export function logErrorAndExit(message: string): never {
  logger.error(message);
  return exitSync(1);
}

export function exitSync(code: number): never {
  // Flush logs before exit
  logger.flush();
  process.exit(code);
}

// GT specific logging
export function displayHeader(introString?: string) {
  // The ASCII banner is pure chatter and writes to console directly, bypassing
  // the logger, so gate it here to honor --quiet. startCommand stays outside
  // the gate: it is quiet-aware itself and must still run so the file log
  // gets its [START] marker.
  if (!logger.isQuiet()) {
    displayAsciiTitle();
    displayInitializingText();
  }

  if (introString) {
    logger.startCommand(introString);
  }
}

function displayAsciiTitle() {
  // eslint-disable-next-line no-console
  console.log(
    chalk.cyan(
      `\n    @@@@@@@@@@@@@@@@@@@@@@
  @@  @@@@@@@@@@@@ @@@@@@@
 @@ @@@          @ @
@@ @@            @ @
@@ @      @@@@@  @ @
@@ @@     @@@ @  @ @
 @@ @@      @ @  @ @
  @@  @@@@@@@ @  @ @
    @@@@@@@@@    @ @`
    )
  );
}

function displayInitializingText() {
  const version = getCLIVersion();
  // eslint-disable-next-line no-console
  console.log(
    `\n${chalk.bold.blue('General Translation, Inc.')}
${chalk.dim('https://generaltranslation.com/docs')}
${chalk.dim(`CLI Version: ${version}\n`)}`
  );
}

export function displayProjectId(projectId: string) {
  logger.message(
    chalk.dim(`Project ID: ${chalk.bold(projectId)}`),
    chalk.cyan('~')
  );
}

export function displayResolvedPaths(resolvedPaths: [string, string][]) {
  const paths = resolvedPaths.map(([key, resolvedPath]) => {
    return chalk.dim(`'${chalk.white(key)}' → '${chalk.green(resolvedPath)}'`);
  });
  logger.step(`Resolved path aliases:\n${paths.join('\n')}`);
}

export function displayCreatedConfigFile(configFilepath: string) {
  logger.step(`Created config file ${chalk.cyan(configFilepath)}`);
}

export function displayUpdatedConfigFile(configFilepath: string) {
  logger.success(`Updated config file ${chalk.cyan(configFilepath)}`);
}

export function displayUpdatedVersionsFile(versionFilepath: string) {
  logger.success(`Updated versions file ${chalk.cyan(versionFilepath)}`);
}

// Input prompts
export async function promptText({
  message,
  defaultValue,
  validate,
}: {
  message: string;
  defaultValue?: string;
  validate?: (value: string) => boolean | string;
}) {
  const result = await text({
    message,
    placeholder: defaultValue,
    defaultValue,
    validate: validate
      ? (value) => {
          // Clack applies defaultValue after validation; check what Enter returns.
          const validation = validate(value || defaultValue || '');
          return validation === true ? undefined : validation.toString();
        }
      : undefined,
  });
  return exitIfCancelled(result);
}

type LocalePromptContext = {
  userInput: string;
  selectedValues: string[];
  focusedValue?: string;
};

/**
 * Clack keeps the focused option while it still matches a new search, so
 * typing `fr` could leave `af` (Afrikaans) focused. Refocus the top-ranked
 * option whenever the search changes.
 */
function searchableLocaleOptions(
  getOptions: (query: string, selected: string[]) => Option<string>[]
) {
  let lastQuery = '';
  return function (this: LocalePromptContext) {
    const query = this.userInput ?? '';
    if (query !== lastQuery) {
      lastQuery = query;
      this.focusedValue = undefined;
    }
    return getOptions(query, this.selectedValues ?? []);
  };
}

/**
 * Searchable locale options: supported locales ranked by the query, the
 * configured customMapping aliases, and any other valid locale typed or
 * already selected, so aliases and custom tags stay selectable.
 */
export function getLocalePromptOptions(
  query: string,
  selected: string[] = [],
  customMapping?: CustomMapping
): Option<string>[] {
  const normalizedQuery = query.trim().toLowerCase();
  const supported = getFilteredLocaleOptions(query).map((option) => ({
    value: option.code,
    label: option.label,
  }));
  const known = new Set(supported.map((option) => option.value));
  const aliases = Object.keys(customMapping ?? {})
    .filter((alias) => alias.toLowerCase().includes(normalizedQuery))
    .map((alias) => ({ value: alias, label: alias, hint: 'custom mapping' }));
  const typed = parseTypedLocale(query, customMapping);
  const extras = [...selected, ...(typed ? [typed] : [])]
    .filter(
      (locale) =>
        !known.has(locale) && !aliases.some((alias) => alias.value === locale)
    )
    .map((locale) => ({ value: locale, label: locale }));
  return [
    ...new Map(
      [...aliases, ...extras, ...supported].map((option) => [
        option.value,
        option,
      ])
    ).values(),
  ];
}

// Body-only: Clack shows it inline under the prompt.
const noLocaleSelectedError = createDiagnosticMessage({
  whatHappened: 'No locale matches the search',
  fix: 'Change the search and select a locale from the list',
});

export async function promptLocale({
  message,
  defaultValue,
  customMapping,
}: {
  message: string;
  defaultValue?: string;
  customMapping?: CustomMapping;
}) {
  const result = await autocomplete<string>({
    message,
    placeholder: 'Type to search locales',
    initialValue: defaultValue,
    options: searchableLocaleOptions((query) =>
      getLocalePromptOptions(query, [], customMapping)
    ),
    // Enter with no matching option submits nothing; keep asking.
    validate: (value) => (value ? undefined : noLocaleSelectedError),
  });
  return exitIfCancelled(result);
}

export async function promptLocaleList({
  message,
  defaultValue,
  required = true,
  customMapping,
}: {
  message: string;
  defaultValue?: string[];
  required?: boolean;
  customMapping?: CustomMapping;
}) {
  const result = await autocompleteMultiselect<string>({
    message,
    placeholder: 'Type to search, Tab or Space to select',
    initialValues: defaultValue,
    required,
    // Clack only preselects defaults present in the first options list, so
    // keep custom default tags listed even before they are selected.
    options: searchableLocaleOptions((query, selected) =>
      getLocalePromptOptions(
        query,
        [...(defaultValue ?? []), ...selected],
        customMapping
      )
    ),
  });
  return exitIfCancelled(result);
}

export async function promptGlobPatterns({
  message,
  defaultValue,
  validate,
}: {
  label: string;
  message: string;
  defaultValue?: string;
  validate?: (value: string) => boolean | string;
}) {
  return promptText({ message, defaultValue, validate });
}

export async function promptSelect<T>({
  message,
  options,
  defaultValue,
}: {
  message: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  defaultValue?: T;
}) {
  const result = await select({
    message,
    options: options as Option<T>[],
    initialValue: defaultValue,
  });
  return exitIfCancelled(result);
}

export async function promptMultiSelect<T extends string>({
  message,
  options,
  required = true,
}: {
  message: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  required?: boolean;
}) {
  const result = await multiselect({
    message,
    options: options as Option<T>[],
    required,
  });
  return exitIfCancelled(result);
}

export async function promptConfirm({
  message,
  defaultValue = true,
  cancelMessage = 'Operation cancelled',
}: {
  message: string;
  defaultValue?: boolean;
  cancelMessage?: string;
}) {
  const result = await confirm({
    message,
    initialValue: defaultValue,
  });
  return exitIfCancelled(result, cancelMessage);
}

// Warning display functions
export function warnApiKeyInConfig(optionsFilepath: string) {
  logger.warn(
    `Found ${chalk.cyan('apiKey')} in "${chalk.green(optionsFilepath)}". ` +
      chalk.white(
        'Your API key is exposed! Remove it from the file and include it as an environment variable.'
      )
  );
}

export function warnVariableProp(
  file: string,
  attrName: string,
  value: string
) {
  logger.warn(
    `Found ${chalk.green('<T>')} component in ${chalk.cyan(file)} with variable ${attrName}: "${chalk.white(value)}". ` +
      `Change "${attrName}" to ensure this content is translated.`
  );
}

export function warnNoId(file: string) {
  logger.warn(
    `Found ${chalk.green('<T>')} component in ${chalk.cyan(file)} with no id. ` +
      chalk.white('Add an id to ensure the content is translated.')
  );
}

export function warnHasUnwrappedExpression(
  file: string,
  id: string,
  unwrappedExpressions: string[]
) {
  logger.warn(
    `${chalk.green('<T>')} with id "${id}" in ${chalk.cyan(file)} has children: ${unwrappedExpressions.join(', ')} that could change at runtime. ` +
      chalk.white('Use a variable component like ') +
      chalk.green('<Var>') +
      chalk.white(' (') +
      chalk.blue('https://generaltranslation.com/docs') +
      chalk.white(') to translate this properly.')
  );
}

export function warnTemplateLiteral(file: string, value: string) {
  logger.warn(
    `Found template literal with quasis (${value}) in ${chalk.cyan(file)}. ` +
      chalk.white(
        'Change the template literal to a string to ensure this content is translated.'
      )
  );
}

export function warnTernary(file: string) {
  logger.warn(
    `Found ternary expression in ${chalk.cyan(file)}. ` +
      chalk.white('A Branch component may be more appropriate here.')
  );
}

export function warnDeprecatedField(
  deprecatedField: string,
  replacement: string
) {
  logger.warn(
    `${chalk.green(deprecatedField)} is deprecated. ` +
      chalk.white(`Use ${chalk.green(replacement)} instead.`)
  );
}

/**
 * Helper: Log all collected files
 */
export function logCollectedFiles(
  files: Pick<FileToUpload, 'fileName'>[],
  inlineComponents?: number,
  inlineLibrary?: InlineLibrary
): void {
  const elementLabel = getInlineElementsLabel(inlineLibrary);
  logger.message(
    chalk.cyan('Files found in project:') +
      '\n' +
      files
        .map((file) => {
          if (file.fileName === TEMPLATE_FILE_NAME) {
            return `- <${elementLabel}>${inlineComponents ? ` (${inlineComponents})` : ''}`;
          }
          return `- ${file.fileName}`;
        })
        .join('\n')
  );
}

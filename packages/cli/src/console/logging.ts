import {
  text,
  select,
  confirm,
  isCancel,
  cancel,
  multiselect,
} from '@clack/prompts';
import chalk from 'chalk';
import { getCLIVersion } from '../utils/packageJson.js';
import { logger } from './logger.js';
import { TEMPLATE_FILE_NAME } from '../utils/constants.js';
import { FileToUpload } from 'generaltranslation/types';

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
  displayAsciiTitle();
  displayInitializingText();

  if (introString) {
    logger.startCommand(introString);
  }
}

function displayAsciiTitle() {
  console.log(
    chalk.cyan(
      `\n  ,ad8888ba,  888888888888  
 d8"'    \`"8b      88       
d8'                88       
88                 88       
88      88888      88       
Y8,        88      88       
 Y8a.    .a88      88       
  \`"Y88888P"       88       `
    )
  );
}

function displayInitializingText() {
  const version = getCLIVersion();
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
    validate: validate
      ? (value) => {
          const validation = validate(value || '');
          return validation === true ? undefined : validation.toString();
        }
      : undefined,
  });

  if (isCancel(result)) {
    cancel('Operation cancelled');
    return exitSync(0);
  }

  return result;
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
  // Convert options to the format expected by clack
  const clackOptions = options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    hint: opt.hint,
  }));

  const result = await select({
    message,
    options: clackOptions as any,
    initialValue: defaultValue,
  });

  if (isCancel(result)) {
    cancel('Operation cancelled');
    return exitSync(0);
  }

  return result as T;
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
  // Convert options to the format expected by clack
  const clackOptions = options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    hint: opt.hint,
  }));

  const result = await multiselect({
    message,
    options: clackOptions as any,
    required,
  });

  if (isCancel(result)) {
    cancel('Operation cancelled');
    return exitSync(0);
  }

  return result as Array<T>;
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

  if (isCancel(result)) {
    cancel(cancelMessage);
    return exitSync(0);
  }

  return result;
}

// Warning display functions
export function warnApiKeyInConfig(optionsFilepath: string) {
  logger.warn(
    `Found ${chalk.cyan('apiKey')} in "${chalk.green(optionsFilepath)}". ` +
      chalk.white(
        'Your API key is exposed! Please remove it from the file and include it as an environment variable.'
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

export function warnNonStaticExpression(
  file: string,
  attrName: string,
  value: string
) {
  logger.warn(
    `Found non-static expression in ${chalk.cyan(file)} for attribute ${attrName}: "${chalk.white(value)}". ` +
      `Change "${attrName}" to ensure this content is translated.`
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

/**
 * Helper: Log all collected files
 */
export function logCollectedFiles(
  files: FileToUpload[],
  reactComponents?: number
): void {
  logger.message(
    chalk.cyan('Files found in project:') +
      '\n' +
      files
        .map((file) => {
          if (file.fileName === TEMPLATE_FILE_NAME) {
            return `- <React Elements>${reactComponents ? ` (${reactComponents})` : ''}`;
          }
          return `- ${file.fileName}`;
        })
        .join('\n')
  );
}

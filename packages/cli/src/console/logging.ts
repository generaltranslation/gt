import {
  log,
  spinner,
  intro,
  outro,
  text,
  select,
  confirm,
  isCancel,
  cancel,
  multiselect,
} from '@clack/prompts';
import chalk from 'chalk';

// Basic logging functions
export function logInfo(message: string) {
  log.info(message);
}
export function logWarning(message: string) {
  log.warn(message);
}
export function logError(message: string) {
  log.error(message);
}
export function logSuccess(message: string) {
  log.success(message);
}
export function logStep(message: string) {
  log.step(message);
}
export function logMessage(message: string) {
  log.message(message, { symbol: chalk.cyan('~') });
}

export function logErrorAndExit(message: string) {
  log.error(message);
  process.exit(1);
}

// Clack prompts
export function startCommand(message: string) {
  intro(chalk.cyan(message));
}
export function endCommand(message: string) {
  outro(chalk.cyan(message));
}

// GT specific logging
export function displayHeader(introString?: string) {
  displayAsciiTitle();
  displayInitializingText();
  if (introString) {
    startCommand(introString);
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
  console.log(
    `\n${chalk.bold.blue('General Translation, Inc.')}\n${chalk.gray('https://generaltranslation.com/docs')}\n`
  );
}

export function displayProjectId(projectId: string) {
  logMessage(chalk.gray(`Project ID: ${chalk.bold(projectId)}`));
}

export function displayResolvedPaths(resolvedPaths: [string, string][]) {
  const paths = resolvedPaths.map(([key, resolvedPath]) => {
    return chalk.gray(`'${chalk.white(key)}' → '${chalk.green(resolvedPath)}'`);
  });
  log.step(`Resolved path aliases:\n${paths.join('\n')}`);
}

export function displayCreatedConfigFile(configFilepath: string) {
  log.success(`Created config file ${chalk.cyan(configFilepath)}`);
}

export function displayUpdatedConfigFile(configFilepath: string) {
  log.success(`Updated config file ${chalk.cyan(configFilepath)}`);
}

// Spinner functionality
export function createSpinner(indicator: 'dots' | 'timer' = 'timer') {
  return spinner({ indicator });
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
          const validation = validate(value);
          return validation === true ? undefined : validation.toString();
        }
      : undefined,
  });

  if (isCancel(result)) {
    cancel('Operation cancelled');
    process.exit(0);
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
    process.exit(0);
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
    process.exit(0);
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
    process.exit(0);
  }

  return result;
}

// Warning display functions
export function warnApiKeyInConfig(optionsFilepath: string) {
  log.warn(
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
  log.warn(
    `Found ${chalk.green('<T>')} component in ${chalk.cyan(file)} with variable ${attrName}: "${chalk.white(value)}". ` +
      `Change "${attrName}" to ensure this content is translated.`
  );
}

export function warnNoId(file: string) {
  log.warn(
    `Found ${chalk.green('<T>')} component in ${chalk.cyan(file)} with no id. ` +
      chalk.white('Add an id to ensure the content is translated.')
  );
}

export function warnHasUnwrappedExpression(
  file: string,
  id: string,
  unwrappedExpressions: string[]
) {
  log.warn(
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
  log.warn(
    `Found non-static expression in ${chalk.cyan(file)} for attribute ${attrName}: "${chalk.white(value)}". ` +
      `Change "${attrName}" to ensure this content is translated.`
  );
}

export function warnTemplateLiteral(file: string, value: string) {
  log.warn(
    `Found template literal with quasis (${value}) in ${chalk.cyan(file)}. ` +
      chalk.white(
        'Change the template literal to a string to ensure this content is translated.'
      )
  );
}

export function warnTernary(file: string) {
  log.warn(
    `Found ternary expression in ${chalk.cyan(file)}. ` +
      chalk.white('A Branch component may be more appropriate here.')
  );
}

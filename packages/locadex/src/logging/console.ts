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
  taskLog,
} from '@clack/prompts';
import chalk from 'chalk';
import { getLocadexVersion } from '../utils/getPaths.js';

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
export function displayHeader() {
  displayAsciiTitle();
  displayInitializingText();
  startCommand(chalk.cyan(`Locadex v${getLocadexVersion()}`));
}

function displayAsciiTitle() {
  // eslint-disable-next-line no-console
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
  // eslint-disable-next-line no-console
  console.log(
    `\n${chalk.bold.blue('General Translation, Inc.')}
${chalk.dim('https://generaltranslation.com/docs')}

${chalk.dim('Locadex uses Sentry and PostHog to collect anonymous telemetry data. You can opt out by running with the --no-telemetry flag.')}
`
  );
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
          const validation = validate(value || '');
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

export function createTaskLogger(message: string) {
  return taskLog({ title: message });
}

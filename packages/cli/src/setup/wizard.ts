import chalk from 'chalk';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { detectFormatter, formatFiles } from '../hooks/postProcess.js';
import type { Formatter } from '../hooks/postProcess.js';
import { exitSync, promptConfirm, promptSelect } from '../console/logging.js';
import { logger } from '../console/logger.js';
import type {
  ReactFrameworkObject,
  SupportedReactFrameworks,
} from '../types/index.js';
import findFilepath from '../fs/findFilepath.js';
import { handleInitGT } from '../next/parse/handleInitGT.js';
import { getPackageJson, isPackageInstalled } from '../utils/packageJson.js';
import { wrapContentNext } from '../next/parse/wrapContent.js';
import { loadConfig } from '../fs/config/loadConfig.js';
import {
  getFrameworkDisplayName,
  getReactFrameworkLibrary,
} from './frameworkUtils.js';
import { Libraries } from '../types/libraries.js';
import type { InitOptions, OnboardingSession } from './onboarding.js';

/** Everything the React application setup will do, resolved before changes. */
export type ReactSetupPlan = {
  framework: SupportedReactFrameworks;
  packageJson: Record<string, unknown>;
  /** GT library to install, when it is not installed yet. */
  install?: string;
  nextConfigPath?: string;
  formatter?: Formatter;
};

const cancelledMessage =
  'Operation cancelled. You can re-run this wizard with: npx gt init';

/**
 * Resolves whether and how to set up the React application. Returns
 * undefined when the setup is declined or an answer is still missing.
 */
export async function resolveReactSetup(
  session: OnboardingSession,
  options: InitOptions,
  detected: ReactFrameworkObject,
  configuredFramework?: SupportedReactFrameworks
): Promise<ReactSetupPlan | undefined> {
  const library = getReactFrameworkLibrary(detected);
  const setupApp = await session.answer('--react-setup', {
    explicit: options.reactSetup,
    recommended: true,
    ask: () =>
      promptConfirm({
        message:
          detected.name === 'vite'
            ? `Would you like to install ${library} and configure initializeGTSPA? See the docs for more information: https://generaltranslation.com/docs/react/tutorials/quickstart`
            : `Would you like to install ${library} and add the GTProvider? See the docs for more information: https://generaltranslation.com/docs/react/tutorials/quickstart`,
        defaultValue: true,
      }),
  });
  if (!setupApp) return undefined;

  // A prompted opt-in gets a last warning; flags and defaults already chose.
  if (!session.defaults && options.reactSetup === undefined) {
    const answer = await promptConfirm({
      message: chalk.yellow(
        `This wizard will configure your ${getFrameworkDisplayName(detected)} project for internationalization with GT. If your project is already using a different i18n library, this wizard may cause issues.

Make sure you have committed or stashed any changes. Do you want to continue?`
      ),
      defaultValue: true,
      cancelMessage: cancelledMessage,
    });
    if (!answer) {
      logger.info(cancelledMessage);
      return exitSync(0);
    }
  }

  const framework = await session.answer<SupportedReactFrameworks | 'other'>(
    '--framework',
    {
      explicit: options.framework,
      configured: configuredFramework,
      recommended: detected.name,
      ask: () =>
        promptSelect<SupportedReactFrameworks | 'other'>({
          message: 'Which framework are you using?',
          options: [
            { value: 'next-app', label: chalk.blue('Next.js App Router') },
            { value: 'next-pages', label: chalk.green('Next.js Pages Router') },
            { value: 'vite', label: chalk.cyan('Vite + React') },
            { value: 'gatsby', label: chalk.magenta('Gatsby') },
            { value: 'react', label: chalk.yellow('React') },
            { value: 'redwood', label: chalk.red('RedwoodJS') },
            { value: 'other', label: chalk.dim('Other') },
          ],
          defaultValue: detected.name,
        }),
    }
  );
  if (framework === 'other') {
    logger.error(
      `Sorry, the wizard doesn't currently support other React frameworks.
Please let us know what you would like to see added at https://github.com/generaltranslation/gt/issues`
    );
    return exitSync(0);
  }
  if (!framework) return undefined;

  const packageJson = await getPackageJson();
  if (!packageJson) {
    session.reject(
      'No package.json found in the current directory. Run this command from the root of your project'
    );
    return undefined;
  }
  const install =
    framework === 'next-app' ? Libraries.GT_NEXT : Libraries.GT_REACT;
  const plan: ReactSetupPlan = {
    framework,
    packageJson,
    install: isPackageInstalled(install, packageJson) ? undefined : install,
  };

  if (framework === 'next-app') {
    plan.nextConfigPath = findFilepath([
      './next.config.js',
      './next.config.ts',
      './next.config.mjs',
      './next.config.mts',
    ]);
    if (!plan.nextConfigPath) {
      session.reject('No next.config.[js|ts|mjs|mts] file found');
    }
    const formatter = await detectFormatter();
    if (
      formatter &&
      (await session.answer('--format', {
        explicit: options.format,
        recommended: true,
        ask: () =>
          promptConfirm({
            message: `Would you like the wizard to auto-format the modified files? ${chalk.dim(
              `(${formatter})`
            )}`,
            defaultValue: true,
          }),
      }))
    ) {
      plan.formatter = formatter;
    }
  }
  return plan;
}

/** Wraps Next.js App Router content and adds withGTConfig(); installs happen first. */
export async function executeReactSetup(
  session: OnboardingSession,
  plan: ReactSetupPlan,
  options: InitOptions
): Promise<void> {
  if (plan.framework !== 'next-app' || !plan.nextConfigPath) return;

  const errors: string[] = [];
  const warnings: string[] = [];
  const spinner = logger.createSpinner();
  spinner.start('Wrapping JSX content with <T> tags...');
  // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
  const { filesUpdated } = await wrapContentNext(
    {
      ...options,
      disableIds: true,
      disableFormatting: true,
      skipTs: true,
      addGTProvider: true,
    },
    Libraries.GT_NEXT,
    errors,
    warnings
  );
  spinner.stop(
    chalk.green(
      `Success! Updated ${chalk.bold.cyan(filesUpdated.length)} files:\n`
    ) + filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
  );
  if (filesUpdated.length > 0) session.step('wrapped JSX content');

  // Add the withGTConfig() function to the next.config.js file
  const tsconfigPath = findFilepath(['tsconfig.json']);
  await handleInitGT(
    plan.nextConfigPath,
    errors,
    warnings,
    filesUpdated,
    plan.packageJson,
    tsconfigPath ? loadConfig(tsconfigPath) : undefined
  );

  if (warnings.length > 0) {
    logger.warn(
      chalk.yellow('Warnings encountered:') +
        '\n' +
        warnings.map((warning) => `${chalk.yellow('-')} ${warning}`).join('\n')
    );
  }
  if (errors.length > 0) {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'Setup could not update some application files',
        details: errors,
        fix: 'Fix the reported files, then rerun `npx gt init`',
      })
    );
  }
  logger.step(
    chalk.green(`Added withGTConfig() to your ${plan.nextConfigPath} file.`)
  );
  session.step(`added withGTConfig() to ${plan.nextConfigPath}`);

  if (plan.formatter) await formatFiles(filesUpdated, plan.formatter);
}

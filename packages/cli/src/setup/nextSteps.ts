import path from 'node:path';
import type { SupportedReactFrameworks } from '../types/index.js';
import { getReactFrameworkLibrary } from './frameworkUtils.js';
import {
  CACHE_COMPONENTS_DOCS_URL,
  CACHE_COMPONENTS_SETUP_STEP,
} from '../next/cacheComponents.js';

export type InitNextStepsContext = {
  framework: SupportedReactFrameworks;
  /** Setup added the GT provider or initializer to the app entry. */
  configuredAppEntry: boolean;
  /** Next.js cacheComponents left <GTProvider> to the Cache Components guide. */
  cacheComponents?: boolean;
  /** Setup guide for the framework. */
  docsUrl: string;
  locales: string[];
  /** The config setup wrote; named in the translate command unless default. */
  configFilepath: string;
  /** Set when translations are stored locally. */
  translationsDir?: string;
  /** The command that starts the dev server, when the app has a dev script. */
  devCommand?: string;
};

/**
 * What a person still has to do after the React setup: it configures the
 * app entry but never marks content for translation. Plain text, so the same
 * steps can be printed and reported in the --json result.
 */
export function getInitNextSteps({
  framework,
  configuredAppEntry,
  cacheComponents,
  docsUrl,
  locales,
  configFilepath,
  translationsDir,
  devCommand,
}: InitNextStepsContext): string[] {
  const library = getReactFrameworkLibrary({ name: framework, type: 'react' });
  const destination = translationsDir
    ? ` and save them to ${translationsDir}`
    : '';
  const appEntrySteps = cacheComponents
    ? [`${CACHE_COMPONENTS_SETUP_STEP} (see ${CACHE_COMPONENTS_DOCS_URL})`]
    : configuredAppEntry
      ? []
      : [
          `Add <GTProvider> from ${library} to the root of your app (see ${docsUrl})`,
        ];
  return [
    ...appEntrySteps,
    `Wrap the text you want translated in <T>, or translate strings with useGT(); both come from ${library} (see ${docsUrl})`,
    `Add <LocaleSelector /> from ${library} so visitors can switch language`,
    `${getTranslateInstruction(configFilepath)} to translate your content into ${locales.join(', ')}${destination}`,
    devCommand
      ? `Start the dev server with \`${devCommand}\` and switch language`
      : 'Start your dev server and switch language',
  ];
}

/**
 * gt translate reads gt.config.json from the working directory by default,
 * so another config is named with --config. A path goes into the command
 * only when POSIX shells, Command Prompt and PowerShell all read it
 * literally; no quoting works the same in all of them, so any other path is
 * named outside the command.
 */
export function getTranslateInstruction(
  configFilepath: string,
  platform: NodeJS.Platform = process.platform
): string {
  if (path.resolve(configFilepath) === path.resolve('gt.config.json')) {
    return 'Run `npx gt translate`';
  }
  const literal = platform === 'win32' ? /^[\w./\\:+=-]+$/ : /^[\w./:+=-]+$/;
  return literal.test(configFilepath)
    ? `Run \`npx gt translate --config ${configFilepath}\``
    : `Run \`npx gt translate\` with --config set to your config file (${configFilepath})`;
}

/** The final wizard message: one Done!, then the numbered next steps. */
export function formatInitNextSteps(steps: string[]): string {
  return [
    'Done! Setup did not mark any content for translation, so your app still renders only in its default locale. Since this wizard is experimental, please review its changes.',
    '',
    'Next steps:',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

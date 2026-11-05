import path from 'node:path';
import type { SupportedReactFrameworks } from '../types/index.js';
import { getReactFrameworkLibrary } from './frameworkUtils.js';

export type InitNextStepsContext = {
  framework: SupportedReactFrameworks;
  /** Setup added the GT provider or initializer to the app entry. */
  configuredAppEntry: boolean;
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
  // gt translate reads gt.config.json from the working directory by default.
  const configFlag =
    path.resolve(configFilepath) === path.resolve('gt.config.json')
      ? ''
      : ` --config ${quoteShellArgument(configFilepath)}`;
  return [
    ...(configuredAppEntry
      ? []
      : [
          `Add <GTProvider> from ${library} to the root of your app (see ${docsUrl})`,
        ]),
    `Wrap the text you want translated in <T>, or translate strings with useGT(); both come from ${library} (see ${docsUrl})`,
    `Add <LocaleSelector /> from ${library} so visitors can switch language`,
    `Run \`npx gt translate${configFlag}\` to translate your content into ${locales.join(', ')}${destination}`,
    devCommand
      ? `Start the dev server with \`${devCommand}\` and switch language`
      : 'Start your dev server and switch language',
  ];
}

/**
 * Quotes a path for the shell the person most likely uses: POSIX single
 * quotes, or double quotes on Windows, where Command Prompt keeps single
 * quotes in the argument and paths cannot contain double quotes.
 */
export function quoteShellArgument(
  value: string,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') {
    return /^[\w@%+=:,./\\-]+$/.test(value) ? value : `"${value}"`;
  }
  return /^[\w@%+=:,./-]+$/.test(value)
    ? value
    : `'${value.replace(/'/g, `'\\''`)}'`;
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

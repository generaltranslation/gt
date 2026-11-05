import type { SupportedReactFrameworks } from '../types/index.js';
import { getReactFrameworkLibrary } from './frameworkUtils.js';

export type InitNextStepsContext = {
  framework: SupportedReactFrameworks;
  /** Setup added the GT provider or initializer to the app entry. */
  configuredAppEntry: boolean;
  /** Setup guide for the framework. */
  docsUrl: string;
  locales: string[];
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
  translationsDir,
  devCommand,
}: InitNextStepsContext): string[] {
  const library = getReactFrameworkLibrary({ name: framework, type: 'react' });
  const destination = translationsDir
    ? ` and save them to ${translationsDir}`
    : '';
  return [
    ...(configuredAppEntry
      ? []
      : [
          `Add <GTProvider> from ${library} to the root of your app (see ${docsUrl})`,
        ]),
    `Wrap the text you want translated in <T>, or translate strings with useGT(); both come from ${library} (see ${docsUrl})`,
    `Add <LocaleSelector /> from ${library} so visitors can switch language`,
    `Run \`npx gt translate\` to translate your content into ${locales.join(', ')}${destination}`,
    devCommand
      ? `Start the dev server with \`${devCommand}\` and switch language`
      : 'Start your dev server and switch language',
  ];
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

import { Command } from 'commander';
import findFilepath from '../fs/findFilepath.js';

const DEFAULT_TIMEOUT = 600;

export function attachTranslateFlags(command: Command) {
  command
    .option(
      '-c, --config <path>',
      'Filepath to config file, by default gt.config.json',
      findFilepath(['gt.config.json'])
    )
    .option('--api-key <key>', 'API key for General Translation cloud service')
    .option('--project-id <id>', 'General Translation project ID')
    .option('--version-id <id>', 'General Translation version ID')
    .option(
      '--default-language, --default-locale <locale>',
      'Default locale (e.g., en)'
    )
    .option(
      '--new, --locales <locales...>',
      'Space-separated list of locales (e.g., en fr es)'
    )
    .option(
      '--dry-run',
      'Dry run, do not send updates to the General Translation API',
      false
    )
    .option(
      '--timeout <seconds>',
      'Translation wait timeout in seconds',
      (value) => {
        const parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue)) {
          throw new Error('Not a number.');
        }
        if (parsedValue < 0) {
          throw new Error('Timeout must be a positive number.');
        }
        return parsedValue;
      },
      DEFAULT_TIMEOUT
    )
    .option('--publish', 'Publish translations to the CDN', false)
    .option(
      '--experimental-localize-static-urls',
      'Triggering this will run a script after the cli tool that localizes all urls in content files. Currently only supported for md and mdx files.',
      false
    )
    .option(
      '--experimental-hide-default-locale',
      'When localizing static locales, hide the default locale from the path',
      false
    )
    .option(
      '--experimental-flatten-json-files',
      'Triggering this will flatten the json files into a single file. This is useful for projects that have a lot of json files.',
      false
    )
    .option(
      '--experimental-localize-static-imports',
      'Triggering this will run a script after the cli tool that localizes all static imports in content files. Currently only supported for md and mdx files.',
      false
    )
    .option(
      '--force',
      'Force a retranslation, invalidating all existing cached translations if they exist.',
      false
    )
    .option(
      '--clear-translated-files',
      'Clear translated files before downloading new translations',
      false
    );
  return command;
}

export function attachAdditionalReactTranslateFlags(command: Command) {
  command
    .option(
      '--tsconfig, --jsconfig <path>',
      'Path to custom jsconfig or tsconfig file',
      findFilepath(['./tsconfig.json', './jsconfig.json'])
    )
    .option('--dictionary <path>', 'Path to dictionary file')
    .option(
      '--src <paths...>',
      "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'"
    )
    .option(
      '--inline',
      'Include inline <T> tags in addition to dictionary file',
      true
    )
    .option(
      '--ignore-errors',
      'Ignore errors encountered while scanning for <T> tags',
      false
    );
  return command;
}

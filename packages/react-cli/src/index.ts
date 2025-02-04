#!/usr/bin/env node

import { program } from 'commander';
import loadJSON from './fs/loadJSON';
import findFilepath, { findFilepaths } from './fs/findFilepath';
import createESBuildConfig from './config/createESBuildConfig';
import createDictionaryUpdates from './updates/createDictionaryUpdates';
import createInlineUpdates from './updates/createInlineUpdates';
import { isValidLocale } from 'generaltranslation';
import updateConfigFile from './fs/updateConfigFile';
import {
  displayAsciiTitle,
  displayInitializingText,
  displayLoadingAnimation,
  displayProjectId,
} from './console/console';
import { warnApiKeyInConfig } from './console/warnings';
import { noTranslationsError } from './console/errors';
import { defaultBaseUrl } from 'generaltranslation/internal';
import chalk from 'chalk';
import scanForContent from './updates/scanForContent';
import { select } from '@inquirer/prompts';

export type Updates = (
  | {
      type: 'jsx';
      source: any;
      metadata: Record<string, any>;
    }
  | {
      type: 'content';
      source: any;
      metadata: Record<string, any>;
    }
)[];

export type Options = {
  options: string;
  apiKey?: string;
  projectId?: string;
  jsconfig?: string;
  dictionary?: string;
  src?: string[];
  defaultLocale?: string;
  locales?: string[];
  baseUrl: string;
  inline?: boolean;
  ignoreErrors: boolean;
  dryRun: boolean;
  wait: boolean;
};

export type WrapOptions = {
  src: string[];
  options: string;
};

function resolveProjectId(): string | undefined {
  const CANDIDATES = [
    process.env.GT_PROJECT_ID, // any server side, Remix
    process.env.NEXT_PUBLIC_GT_PROJECT_ID, // Next.js
    process.env.VITE_GT_PROJECT_ID, // Vite
    process.env.REACT_APP_GT_PROJECT_ID, // Create React App
    process.env.REDWOOD_ENV_GT_PROJECT_ID, // RedwoodJS
    process.env.GATSBY_GT_PROJECT_ID, // Gatsby
    process.env.EXPO_PUBLIC_GT_PROJECT_ID, // Expo (React Native)
    process.env.RAZZLE_GT_PROJECT_ID, // Razzle
    process.env.UMI_GT_PROJECT_ID, // UmiJS
    process.env.BLITZ_PUBLIC_GT_PROJECT_ID, // Blitz.js
    process.env.PUBLIC_GT_PROJECT_ID, // WMR, Qwik (general "public" convention)
  ];
  return CANDIDATES.find((projectId) => projectId !== undefined);
}

export default function main(framework: 'gt-next' | 'gt-react') {
  // First command: translate
  program
    .command('translate')
    .description(
      'Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.'
    )
    .option(
      '--options <path>',
      'Filepath to options JSON file, by default gt.config.json',
      './gt.config.json'
    )
    .option('--api-key <key>', 'API key for General Translation cloud service')
    .option(
      '--project-id <id>',
      'Project ID for the translation service',
      resolveProjectId()
    )
    .option(
      '--tsconfig, --jsconfig <path>',
      'Path to jsconfig or tsconfig file',
      findFilepath(['./tsconfig.json', './jsconfig.json'])
    )
    .option(
      '--dictionary <path>',
      'Path to dictionary file',
      findFilepath([
        './dictionary.js',
        './src/dictionary.js',
        './dictionary.json',
        './src/dictionary.json',
        './dictionary.jsx',
        './src/dictionary.jsx',
        './dictionary.ts',
        './src/dictionary.ts',
        './dictionary.tsx',
        './src/dictionary.tsx',
      ])
    )
    .option(
      '--src <path>',
      "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components",
      findFilepaths(['./src', './app', './pages', './components'])
    )
    .option(
      '--default-language, --default-locale <locale>',
      'Default locale (e.g., en)'
    )
    .option(
      '--languages, --locales <locales...>',
      'Space-separated list of locales (e.g., en fr es)',
      []
    )
    .option(
      '--inline',
      'Include inline <T> tags in addition to dictionary file',
      true
    )
    .option(
      '--wrap',
      'Wraps all JSX elements in the src directory with a <T> tag, with unique ids',
      false
    )
    .option(
      '--ignore-errors',
      'Ignore errors encountered while scanning for <T> tags',
      false
    )
    .option(
      '--dry-run',
      'Dry run, does not send updates to General Translation API',
      false
    )
    .option(
      '--wait',
      'Wait for the updates to be deployed to the CDN before exiting',
      true
    )
    .action(async (options: Options) => {
      displayAsciiTitle();
      displayInitializingText();

      // ------ SETUP ----- //

      // Consolidate config options
      // options given in command || --options filepath || ./gt.config.json || parsing next.config.js
      // it's alright for any of the options to be undefined at this point

      // --options filepath || gt.config.json
      const gtConfig = loadJSON(options.options) || {};

      options = { ...gtConfig, ...options };
      options.apiKey = options.apiKey || process.env.GT_API_KEY;
      if (!options.baseUrl) options.baseUrl = defaultBaseUrl;

      // Error if no API key at this point
      if (!options.apiKey)
        throw new Error(
          'No General Translation API key found. Use the --api-key flag to provide one.'
        );
      // Warn if apiKey is present in gt.config.json
      if (gtConfig.apiKey) {
        warnApiKeyInConfig(options.options);
        process.exit(1);
      }

      // Error if no API key at this point
      if (!options.projectId)
        throw new Error(
          'No General Translation Project ID found. Use the --project-id flag to provide one.'
        );

      displayProjectId(options.projectId);

      // Check locales
      if (options.defaultLocale && !isValidLocale(options.defaultLocale))
        throw new Error(
          `defaultLocale: ${options.defaultLocale} is not a valid locale!`
        );
      if (options.locales) {
        for (const locale of options.locales) {
          if (!isValidLocale(locale)) {
            throw new Error(
              `locales: "${options?.locales?.join()}", ${locale} is not a valid locale!`
            );
          }
        }
      }

      // // manually parsing next.config.js (or .mjs, .cjs, .ts etc.)
      // // not foolproof but can't hurt
      // const nextConfigFilepath = findFilepath([
      //   "./next.config.mjs",
      //   "./next.config.js",
      //   "./next.config.ts",
      //   "./next.config.cjs",
      // ]);
      // if (nextConfigFilepath)
      //   options = { ...parseNextConfig(nextConfigFilepath), ...options };

      // if there's no existing config file, creates one
      // does not include the API key to avoid exposing it
      const { apiKey, ...rest } = options;
      if (options.options) updateConfigFile(rest.options, rest);

      // ---- CREATING UPDATES ---- //

      let updates: Updates = [];
      let errors: string[] = [];

      // Parse dictionary with esbuildConfig
      if (options.dictionary) {
        let esbuildConfig;
        if (options.jsconfig) {
          const jsconfig = loadJSON(options.jsconfig);
          if (!jsconfig)
            throw new Error(
              `Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`
            );
          esbuildConfig = createESBuildConfig(jsconfig);
        } else {
          esbuildConfig = createESBuildConfig({});
        }
        updates = [
          ...updates,
          ...(await createDictionaryUpdates(options as any, esbuildConfig)),
        ];
      }

      // Scan through project for <T> tags
      if (options.inline) {
        const { updates: newUpdates, errors: newErrors } =
          await createInlineUpdates(options);
        errors = [...errors, ...newErrors];
        updates = [...updates, ...newUpdates];
      }

      // Metadata addition and validation
      const idHashMap = new Map<string, string>();
      const duplicateIds = new Set<string>();

      updates = updates.map((update) => {
        const existingHash = idHashMap.get(update.metadata.id);
        if (existingHash) {
          if (existingHash !== update.metadata.hash) {
            errors.push(
              `Hashes don't match on two translations with the same id: ${chalk.blue(
                update.metadata.id
              )}. Check your ${chalk.green(
                `<T id="${chalk.blue(update.metadata.id)}">`
              )} tags and make sure you're not accidentally duplicating IDs.`
            );
            duplicateIds.add(update.metadata.id);
          }
        } else {
          idHashMap.set(update.metadata.id, update.metadata.hash);
        }
        return update;
      });

      // Filter out updates with duplicate IDs
      updates = updates.filter(
        (update) => !duplicateIds.has(update.metadata.id)
      );

      if (errors.length > 0) {
        if (options.ignoreErrors) {
          console.log(
            chalk.red(
              `CLI Tool encountered errors while scanning for ${chalk.green(
                '<T>'
              )} tags.\n`
            )
          );
          console.log(
            errors
              .map((error) => chalk.yellow('• Warning: ') + error + '\n')
              .join(''),
            chalk.white(
              `These ${chalk.green('<T>')} components will not be translated.\n`
            )
          );
        } else {
          console.log(
            chalk.red(
              `CLI Tool encountered errors while scanning for ${chalk.green(
                '<T>'
              )} tags.\n`
            )
          );
          console.log(
            chalk.gray(
              'To ignore these errors, re-run with --ignore-errors\n\n'
            ),
            errors
              .map((error) => chalk.red('• Error: ') + error + '\n')
              .join('')
          );
          process.exit(1);
        }
      }

      if (options.dryRun) {
        process.exit(0);
      }

      // Send updates to General Translation API
      if (updates.length) {
        const { projectId, defaultLocale } = options;
        const globalMetadata = {
          ...(projectId && { projectId }),
          ...(defaultLocale && { sourceLocale: defaultLocale }),
        };

        const body = {
          updates,
          locales: options.locales,
          metadata: globalMetadata,
        };

        const loadingInterval = displayLoadingAnimation(
          'Sending updates to General Translation API...'
        );

        try {
          const response = await fetch(
            `${options.baseUrl}/v1/project/translations/update`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(apiKey && { 'x-gt-api-key': apiKey }),
              },
              body: JSON.stringify(body),
            }
          );

          clearInterval(loadingInterval);
          process.stdout.write('\n\n'); // New line after loading is done

          if (!response.ok) {
            throw new Error(response.status + '. ' + (await response.text()));
          }

          const { versionId, message } = await response.json();
          if (options.options)
            updateConfigFile(options.options, { _versionId: versionId });

          console.log(chalk.green('✓ ') + chalk.green.bold(message));
        } catch (error) {
          clearInterval(loadingInterval);
          process.stdout.write('\n');
          console.log(chalk.red('✗ Failed to send updates'));
          throw error;
        }

        // TODO: add a check to see if the updates were successful by checking the CDN
        if (options.wait && options.locales && options.locales.length > 0) {
          console.log();
          const loadingInterval = displayLoadingAnimation(
            'Waiting for updates to be deployed to the CDN...'
          );

          let attempts = 0;
          const maxAttempts = 60; // 5 minutes total (60 * 5000ms)

          const checkDeployment = async () => {
            if (!options.locales) return false;
            try {
              const promises = options.locales.map((locale) =>
                fetch(`https://cdn.gtx.dev/${projectId}/${locale}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                })
              );

              const responses = await Promise.all(promises);
              const jsonResponses = await Promise.all(
                responses.map((response) => response.ok && response.json())
              );
              return (
                responses.every((r) => r.ok) &&
                jsonResponses.every(
                  (data) => Object.keys(data || {}).length > 0
                )
              );
            } catch (error) {
              return false;
            }
          };

          let intervalCheck: NodeJS.Timeout;
          intervalCheck = setInterval(async () => {
            attempts++;
            const isDeployed = await checkDeployment();

            if (isDeployed || attempts >= maxAttempts) {
              clearInterval(loadingInterval);
              clearInterval(intervalCheck);
              console.log('\n');

              if (isDeployed) {
                console.log(chalk.green('✓ All translations are live!'));
              } else {
                console.log(
                  chalk.yellow('⚠️  Timed out waiting for CDN deployment')
                );
              }
            }
          }, 5000);
        }
      } else {
        throw new Error(noTranslationsError);
      }
    });

  // Second command: setup
  program
    .command('setup')
    .description(
      'Scans the project and wraps all JSX elements in the src directory with a <T> tag, with unique ids'
    )
    .option(
      '--src <path>',
      "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components",
      findFilepaths(['./src', './app', './pages', './components'])
    )
    .option(
      '--options <path>',
      'Filepath to options JSON file, by default gt.config.json',
      './gt.config.json'
    )
    .action(async (options: WrapOptions) => {
      displayAsciiTitle();
      displayInitializingText();

      // Ask user for confirmation using inquirer
      const answer = await select({
        message: chalk.yellow(
          '⚠️  Warning: This operation will modify your source files!\n   Make sure you have committed or stashed your current changes.\n\n   Do you want to continue?'
        ),
        choices: [
          { value: true, name: 'Yes' },
          { value: false, name: 'No' },
        ],
        default: true,
      });

      if (!answer) {
        console.log(chalk.gray('\nOperation cancelled.'));
        process.exit(0);
      }

      // ----- Create a starter gt.config.json file -----

      // --options filepath || gt.config.json
      const gtConfig = loadJSON(options.options) || {
        ...(process.env.GT_PROJECT_ID && {
          projectId: process.env.GT_PROJECT_ID,
        }),
      };
      if (options.options) updateConfigFile(options.options, gtConfig);

      // ----- //

      // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
      const { errors, filesUpdated, warnings } = await scanForContent(
        options,
        framework
      );

      if (errors.length > 0) {
        console.log(chalk.red('\n✗ Failed to write files:\n'));
        console.log(errors.join('\n'));
      }

      console.log(
        chalk.green(
          `\n✓ Success! Added <T> tags and updated ${chalk.bold(
            filesUpdated.length
          )} files:\n`
        )
      );
      if (filesUpdated.length > 0) {
        console.log(
          filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
        );
        console.log();
        console.log(
          chalk.green('Please verify the changes before committing.')
        );
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings encountered:'));
        console.log(
          warnings
            .map((warning) => `${chalk.yellow('-')} ${warning}`)
            .join('\n')
        );
      }
    });

  program.parse();
}

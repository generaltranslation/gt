#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv'
import loadJSON from './fs/loadJSON';
import findFilepath from './fs/findFilepath';
import { parseNextConfig } from './fs/parseNextConfig';
import updateConfigFile from './fs/updateConfigFile';
import createESBuildConfig from './config/createESBuildConfig';
import createDictionaryUpdates from './updates/createDictionaryUpdates';
import createInlineUpdates from './updates/createInlineUpdates';
import GT, { getLocaleProperties, isValidLocale } from 'generaltranslation';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

export type Updates = ({
    "type": "react"
    "data": {
        "children": any,
        "metadata": Record<string, any>
    }
} | {
    "type": "string"
    "data": {
        "content": any,
        "metadata": Record<string, any>
    }
})[];

export type Options = {
    options: string,
    apiKey?: string,
    projectID?: string,
    jsconfig?: string,
    dictionary?: string,
    app?: string,
    defaultLocale?: string,
    locales?: string[],
    description?: string,
    replace: boolean,
    inline: boolean,
    retranslate: boolean
};

program
  .name('i18n')
  .description('Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.')
  .option(
    '--options <path>', 'Filepath to options JSON file, by default gt.config.json', 
    "./gt.config.json"
   )
  .option(
    '--apiKey <key>', 'API key for General Translation cloud service',
    process.env.GT_API_KEY
  )
  .option(
    '--projectID <id>', 'Project ID for the translation service',
    process.env.GT_PROJECT_ID
  )
  .option(
    '--tsconfig, --jsconfig <path>', 'Path to jsconfig or tsconfig file',
    findFilepath(['./tsconfig.json', './jsconfig.json'])
  )
  .option(
    '--dictionary <path>', 'Path to dictionary file',
    findFilepath(
        [
            './dictionary.js', './src/dictionary.js',
            './dictionary.json', './src/dictionary.json',
            './dictionary.jsx', './src/dictionary.jsx',
            './dictionary.ts', './src/dictionary.ts',
            './dictionary.tsx', './src/dictionary.tsx'
        ]
    )
   )
   .option(
    '--app <path>', "Filepath to the app's source directory, by default ./src || ./app", 
    findFilepath(['./src', './app'])
   )
  .option(
    '--defaultLanguage, --defaultLocale <locale>', 'Default locale (e.g., en)'
  )
  .option(
    '--languages, --locales <locales...>',
    'Space-separated list of locales (e.g., en fr es)',
    []
    )
  .option(
    '--description <description>', 'Description for the project or update'
  )
  .option('--replace', 'Replace existing translations in the remote dictionary', false)
  .option('--inline', 'Include inline <T> tags in addition to dictionary file', true)
  .option('--retranslate', 'Forces a new translation for all content.', false)
  .action(async (options: Options) => {

    // ------ SETUP ----- //

    // Consolidate config options
    // options given in command || --options filepath || ./gt.config.json || parsing next.config.js
    // it's alright for any of the options to be undefined at this point

    // --options filepath || gt.config.json
    const gtConfig = loadJSON(options.options) || {};
    options = { ...gtConfig, ...options }

    // Error if no API key at this point
    if (!options.apiKey) throw new Error(
        'No General Translation API key found. Use the --apiKey flag to provide one.'
    );
    // Warn if apiKey is present in gt.config.json
    if (gtConfig.apiKey) {
        console.warn(`Found apiKey in "${options.options}". Are you sure you want to do this? Make sure your API key is not accidentally exposed, e.g. by putting ${options.options} in .gitignore.`)
    }

    // Check locales
    if (options.defaultLocale && !isValidLocale(options.defaultLocale))
        throw new Error(`defaultLocale: ${options.defaultLocale} is not a valid locale!`) 
    if (options.locales) {
        for (const locale of options.locales) {
            if (!isValidLocale(locale)) {
                throw new Error(`locales: "${options?.locales?.join()}", ${locale} is not a valid locale!`)
            }
        }
    }
        
    // Create an esbuild config and error if it doesn't resolve
    let esbuildConfig;
    if (options.jsconfig) {
        const jsconfig = loadJSON(options.jsconfig);
        if (!jsconfig)
            throw new Error(`Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`);
        esbuildConfig = createESBuildConfig(jsconfig);
    } else {
        esbuildConfig = createESBuildConfig({});
    }

    // manually parsing next.config.js (or .mjs, .cjs, .ts etc.)
    // not foolproof but can't hurt
    const nextConfigFilepath = findFilepath(['./next.config.mjs', './next.config.js', './next.config.ts', './next.config.cjs']);
    if (nextConfigFilepath) options = { ...parseNextConfig(nextConfigFilepath), ...options };

    // if there's no existing config file, creates one
    // does not include the API key to avoid exposing it
    // const { apiKey, ...rest } = options;
    // if (options.options) updateConfigFile(rest.options, rest);

    // ---- CREATING UPDATES ---- //

    let updates: Updates = [];

    let initialMetadata = {
        ...(options.defaultLocale && { defaultLocale: options.defaultLocale }),
        ...(options.locales && { locales: options.locales }),
        ...(options.description && { description: options.description })
    }
    
    // Parse dictionary with esbuildConfig
    if (options.dictionary) {
        updates = [...updates, ...(await createDictionaryUpdates(options as any, esbuildConfig))]
    }

    // Scan through project for <T> tags 
    if (options.inline) {
        updates = [...updates, ...(await createInlineUpdates(options))]
    };

    // Metadata addition and validation
    const idHashMap = new Map<string, string>();
    updates = updates.map(update => {
        const existingHash = idHashMap.get(update.data.metadata.id);
        if (existingHash) {
            if (existingHash !== update.data.metadata.hash)
                throw new Error(
                    `Hashes don't match on two translations with the same id: ${update.data.metadata.id}. Check your <T id="${update.data.metadata.id}"> tags and make sure you're not accidentally duplicating IDs.`
                );
        } else {
            idHashMap.set(update.data.metadata.id, update.data.metadata.hash);
        }
        update.data.metadata = {
            ...initialMetadata, ...update.data.metadata
        }
        return update;
    })

    // Send updates to General Translation API
    if (updates.length) {
        const gt = new GT({
            apiKey: options.apiKey,
            ...(options.projectID && { projectID: options.projectID }),
            ...(options.defaultLocale && { defaultLanguage: options.defaultLocale })
        });
        
        const { locales: resultLocales } = await gt.updateProjectTranslations(
            updates, options.locales, {
                apiKey: undefined,
                ...options
            }
        );
        
        if (resultLocales) {
            console.log(
              `Project "${options.projectID}" updated in ${
                resultLocales.length
              } languages.`,
                resultLocales.length &&
               `${resultLocales
                    .map((locale: string) => {
                        const { nameWithRegionCode, languageCode } = getLocaleProperties(locale)
                        return `${languageCode} ${nameWithRegionCode}`
                    })
                .join('\n')}`,
              resultLocales.length
                ? 'Translations are usually live within a minute. Check status: www.generaltranslation.com/dashboard.'
                : ''
            );
        }
    } else {
        throw new Error(`No updates found! Are you sure you're running this command in the right directory?`)
    }

    // Log response
    
});

program.parse();

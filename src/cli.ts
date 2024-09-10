#!/usr/bin/env node

import path from 'path';
import React from 'react';
import { program } from 'commander';
import { flattenDictionary, writeChildrenAsObjects, addGTIdentifier, calculateHash } from 'gt-react/internal';
import GT, { getLanguageName, isValidLanguageCode, getLanguageCode, splitStringToContent } from 'generaltranslation';
import fs from 'fs';
import esbuild from 'esbuild';
import os from 'os'
import { extractI18nConfig } from './extractI18NConfig';
import resolveFilePath from './resolveFilePath';
import applyConfigToEsbuild from './applyConfigToESBuild';
import loadConfigFile from './loadConfigFile';

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

/**
 * Process the config options for the dictionary and i18n files.
 * @param {string} dictionaryFilePath - The path to the dictionary file.
 * @param {string} i18nFilePath - The path to the i18n configuration file.
 * @param {object} options - The options for processing the dictionary file.
 */
async function processConfigOptions(dictionaryFilePath: string, i18nFilePath: string, options: {
    apiKey?: string,
    projectID?: string,
    dictionaryName?: string,
    defaultLanguage?: string,
    languages?: string[],
    override?: boolean,
    config?: any,
    description?: string;
}) {
    const absoluteDictionaryFilePath = path.resolve(dictionaryFilePath);

    // Bundle and transpile the dictionary file using esbuild
    const esbuildOptions = applyConfigToEsbuild(options.config || {});
    const result = await esbuild.build({
        ...esbuildOptions,
        entryPoints: [absoluteDictionaryFilePath],
        write: false,
    });

    // Write the bundled code to a temporary file
    const bundledCode = result.outputFiles[0].text;
    const tempFilePath = path.join(os.tmpdir(), 'bundled-dictionary.js');
    fs.writeFileSync(tempFilePath, bundledCode);

    global.React = React;

    // Load the module using require
    let dictionaryModule;
    try {
        dictionaryModule = require(tempFilePath);
    } catch (error) {
        console.error('Failed to load the bundled dictionary code:', error);
        process.exit(1);
    } finally {
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
    }

    const dictionary = flattenDictionary(dictionaryModule.default || dictionaryModule);

    if (i18nFilePath) {
        const i18nConfig = extractI18nConfig(i18nFilePath);
        options = { ...i18nConfig, ...options };
    }

    return { dictionary, options };
}

/**
 * Construct template updates and send them to the General Translation service.
 * @param {object} dictionary - The processed dictionary object.
 * @param {object} options - The options for processing the dictionary file.
 */
async function constructAndSendUpdates(dictionary: any, options: {
    apiKey?: string,
    projectID?: string,
    dictionaryName?: string,
    defaultLanguage?: string,
    languages?: string[],
    override?: boolean,
    description?: string;
}) {
    const apiKey = options.apiKey || process.env.GT_API_KEY;
    const projectID = options.projectID || process.env.GT_PROJECT_ID;
    const dictionaryName = options.dictionaryName;
    const defaultLanguage = options.defaultLanguage;
    const languages = (options.languages || [])
        .map(language => isValidLanguageCode(language) ? language : getLanguageCode(language))
        .filter(language => language ? true : false);
    const override = options.override ? true : false;
    const description = options.description;

    if (!(apiKey && projectID)) {
        throw new Error('GT_API_KEY and GT_PROJECT_ID environment variables or provided arguments are required.');
    }

    let templateUpdates: any = [];
    for (const id in dictionary) {
        let entry = dictionary[id];
        let metadata: Record<string, any> = { id, dictionaryName };
        if (defaultLanguage) {
            metadata.defaultLanguage = defaultLanguage;
        }
        if (description) {
            metadata.description = description;
        }
        let props: { [key: string]: any } = {};
        if (Array.isArray(entry)) {
            if (typeof entry[1] === 'object') {
                props = entry[1];
            }
            entry = entry[0];
        }
        if (typeof entry === 'function') {
            entry = entry({});
        }
        if (React.isValidElement(entry)) {
            let wrappedEntry;
            const { singular, plural, dual, zero, one, two, few, many, other, ranges, ...tMetadata } = props;
            const pluralProps = Object.fromEntries(
                Object.entries({ singular, plural, dual, zero, one, two, few, many, other, ranges }).filter(([_, value]) => value !== undefined)
            );
            if (Object.keys(pluralProps).length) {
                const Plural = (pluralProps: any) => React.createElement(React.Fragment, pluralProps, entry);
                (Plural as any).gtTransformation = 'plural';
                wrappedEntry = React.createElement(Plural, pluralProps, entry);
            } else {
                wrappedEntry = React.createElement(React.Fragment, null, entry);
            }
            const entryAsObjects = writeChildrenAsObjects(addGTIdentifier(wrappedEntry)); // simulate gt-react's t() function
            const hash = await calculateHash(tMetadata.context ? [entryAsObjects, tMetadata.context] : entryAsObjects);
            tMetadata.hash = hash;
            templateUpdates.push({
                type: "react",
                data: {
                    children: entryAsObjects,
                    metadata: { ...metadata, ...tMetadata }
                }
            });
        } else if (typeof entry === 'string') {
            let content = splitStringToContent(entry);
            if (Array.isArray(content) && content.length > 1) {
                entry = content;
            }
            templateUpdates.push({
                type: "string",
                data: {
                    content: entry,
                    metadata: { ...metadata, ...props }
                }
            });
        }
    }

    if (templateUpdates.length) {
        console.log('Items in dictionary:', templateUpdates.length);
        const gt = new GT({ apiKey, projectID });
        const resultLanguages = await gt.updateProjectDictionary(templateUpdates, languages, projectID, override);
        if (resultLanguages) {
            console.log(
                `Remote dictionary "${dictionaryName}" updated: ${resultLanguages.length ? true : false}.`,
                `Languages: ${resultLanguages.length ? `[${resultLanguages.map(language => `"${getLanguageName(language)}"`).join(', ')}]` + '.' : 'None.'}`,
                resultLanguages.length ? 'Translations are usually live within a minute. Check status: www.generaltranslation.com/dashboard.' : ''
            );
        } else {
            throw new Error('500: Internal Server Error.');
        }
    }

}




program
    .name('i18n')
    .description('Process React dictionary files and send translations to General Translation services')
    .version('1.0.0')
    .argument('[dictionaryFilePath]', 'Path to the dictionary file')
    .option('--apiKey <apiKey>', 'Specify your GT API key')
    .option('--projectID <projectID>', 'Specify your GT project ID')
    .option('--dictionaryName <name>', 'Optionally specify a dictionary name for metadata purposes')
    .option('--languages <languages...>', 'List of target languages for translation')
    .option('--override', 'Override existing translations')
    .option('--defaultLanguage <defaultLanguage>', 'Specify a default language code or name for metadata purposes')
    .option('--config <configFilePath>', 'Specify a path to a tsconfig.json or jsconfig.json file')
    .option('--i18n <i18nFilePath>', 'Specify a path to an i18n.js configuration file. Used to automatically set projectID, defaultLanguage (from defaultLocale), languages (from approvedLocales), and dictionaryName', '')
    .option('--description <description>', 'Describe your project. Used to assist translation.', '')
    .action((dictionaryFilePath: string, options: {
        apiKey?: string,
        projectID?: string,
        dictionaryName?: string,
        defaultLanguage?: string,
        languages?: string[],
        override?: boolean,
        config?: string
        i18n?: string;
        description?: string;
    }) => {
        // Resolve the config file path or check default locations
        const resolvedConfigFilePath = resolveFilePath(options.config || '', [
            './tsconfig.json',
            './jsconfig.json',
        ]);

        // Load and apply the configuration to esbuild
        const config = loadConfigFile(resolvedConfigFilePath);

        const resolvedDictionaryFilePath = resolveFilePath(dictionaryFilePath, [
            './dictionary.js',
            './dictionary.jsx',
            './dictionary.ts',
            './dictionary.tsx',
            './src/dictionary.js',
            './src/dictionary.jsx',
            './src/dictionary.ts',
            './src/dictionary.tsx'
        ], true);

        const resolvedI18NFilePath = resolveFilePath(options.i18n || '', [
            './i18n.js',
            './i18n.jsx',
            './i18n.ts',
            './i18n.tsx',
            './src/i18n.js',
            './src/i18n.jsx',
            './src/i18n.ts',
            './src/i18n.tsx'
        ]);

        const main = async () => {

            let dictionary;
            ({ dictionary, options } = await processConfigOptions(resolvedDictionaryFilePath, resolvedI18NFilePath, { ...options, config }))

            await constructAndSendUpdates(dictionary, options);

        }

        main().then(() => process.exit(0))
        
    });

program.parse();
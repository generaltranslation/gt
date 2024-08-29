#!/usr/bin/env node

import { config } from 'dotenv';
import path from 'path';
import React from 'react';
import { program } from 'commander';
import { flattenDictionary, writeChildrenAsObjects, addGTIdentifier } from 'gt-react';
import GT, { getLanguageName, isValidLanguageCode, getLanguageCode } from 'generaltranslation';
import fs from 'fs';

require('@babel/register')({
    presets: [
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-env'
    ],
    plugins: [
        ['module-resolver', {
            root: ["./src"],
            alias: {} // This will be dynamically populated
        }]
    ],
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    ignore: [/(node_modules)/],
});

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

interface Options {
    apiKey?: string;
    projectID?: string;
    dictionaryName?: string;
    defaultLanguage?: string;
    languages?: string[];
    override?: boolean;
}

/**
 * Attempt to load aliases from common configuration files.
 */
function loadAliases(): Record<string, string> {
    const possibleConfigFiles = [
        'jsconfig.json',
        'tsconfig.json',
        'webpack.config.js',
        '.babelrc',
        'babel.config.js'
    ];

    for (const configFile of possibleConfigFiles) {
        const configPath = path.resolve(configFile);
        if (fs.existsSync(configPath)) {
            if (configFile.endsWith('.json')) {
                const config = require(configPath);
                if (config.compilerOptions && config.compilerOptions.paths) {
                    return config.compilerOptions.paths;
                }
            } else if (configFile.endsWith('webpack.config.js')) {
                const webpackConfig = require(configPath);
                if (webpackConfig.resolve && webpackConfig.resolve.alias) {
                    return webpackConfig.resolve.alias;
                }
            } else if (configFile.includes('babel')) {
                const babelConfig = require(configPath);
                if (babelConfig.plugins) {
                    const resolverPlugin = babelConfig.plugins.find((plugin: any) =>
                        Array.isArray(plugin) && plugin[0] === 'module-resolver'
                    );
                    if (resolverPlugin) {
                        return resolverPlugin[1].alias || {};
                    }
                }
            }
        }
    }

    return {};
}

/**
 * Resolve a module path based on the loaded aliases.
 */
function resolveModulePath(importPath: string, aliases: Record<string, string>): string {
    for (const alias in aliases) {
        if (importPath.startsWith(alias)) {
            const aliasPath = aliases[alias];
            const relativePath = importPath.replace(alias, aliasPath);
            return path.resolve(relativePath);
        }
    }
    return importPath; // Return the original if no alias matches
}

const aliases = loadAliases();

function processDictionaryFile(dictionaryFilePath: string, options: Options): void {
    const absoluteDictionaryFilePath = path.resolve(dictionaryFilePath);

    let dictionary: any;
    try {
        const resolvedFileContent = fs.readFileSync(absoluteDictionaryFilePath, 'utf-8')
            .replace(/from ['"](.*?)['"]/g, (match, importPath) => {
                const resolvedPath = resolveModulePath(importPath, aliases);
                return `from '${resolvedPath}'`;
            });

        const tempFilePath = path.join(__dirname, 'tempDictionaryFile.js');
        fs.writeFileSync(tempFilePath, resolvedFileContent);

        dictionary = require(tempFilePath).default || require(tempFilePath);
        fs.unlinkSync(tempFilePath);
    } catch (error) {
        console.error('Failed to load the dictionary file:', error);
        process.exit(1);
    }

    dictionary = flattenDictionary(dictionary);

    const apiKey = options.apiKey || process.env.GT_API_KEY;
    const projectID = options.projectID || process.env.GT_PROJECT_ID;
    const dictionaryName = options.dictionaryName;
    const defaultLanguage = options.defaultLanguage;
    const languages = (options.languages || [])
        .map(language => isValidLanguageCode(language) ? language : getLanguageCode(language))
        .filter(language => language);
    const override = options.override || false;

    if (!(apiKey && projectID)) {
        throw new Error('GT_API_KEY and GT_PROJECT_ID environment variables or provided arguments are required.');
    }

    let templateUpdates: any[] = [];
    for (const key in dictionary) {
        let entry = dictionary[key];
        let metadata: Record<string, any> = { id: key, dictionaryName };

        if (defaultLanguage) {
            metadata.defaultLanguage = defaultLanguage;
        }

        let props: { [key: string]: any } = {};
        if (Array.isArray(entry)) {
            if (typeof entry[1] === 'object') {
                props = entry[1];
            }
            entry = entry[0];
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

            const entryAsObjects = writeChildrenAsObjects(addGTIdentifier(wrappedEntry));
            templateUpdates.push({
                type: "react",
                data: {
                    children: entryAsObjects,
                    metadata: { ...metadata, ...tMetadata }
                }
            });
        } else if (typeof entry === 'string') {
            templateUpdates.push({
                type: "intl",
                data: {
                    content: entry,
                    metadata: { ...metadata, ...props }
                }
            });
        }
    }

    if (templateUpdates.length) {
        const gt = new GT({ apiKey, projectID });
        const sendUpdates = async () => {
            const resultLanguages = await gt.updateRemoteDictionary(templateUpdates, languages, projectID, override);
            if (resultLanguages) {
                console.log(
                    `Remote dictionary updated: ${resultLanguages.length ? true : false}.`,
                    (`Languages: ${resultLanguages.length ? `[${resultLanguages.map(language => `"${getLanguageName(language)}"`).join(', ')}]` + '.' : 'None.'}`),
                    resultLanguages.length ? 'Translations are usually live within a minute.' : '',
                );
            } else {
                throw new Error('500: Internal Server Error.');
            }
            process.exit(0);
        };
        sendUpdates();
    }

    setTimeout(() => {
        process.exit(0);
    }, 4000);
}

program
    .name('update')
    .description('Process React dictionary files and send translations to General Translation services')
    .version('1.0.0')
    .argument('[dictionaryFilePath]', 'Path to the dictionary file')
    .option('--apiKey <apiKey>', 'Specify your GT API key')
    .option('--projectID <projectID>', 'Specify your GT project ID')
    .option('--dictionaryName <name>', 'Optionally specify a dictionary name for metadata purposes')
    .option('--languages <languages...>', 'List of target languages for translation')
    .option('--override', 'Override existing translations')
    .option('--defaultLanguage <defaultLanguage>', 'Specify a default language code or name for metadata purposes')
    .action((dictionaryFilePath: string, options: Options) => {
        const resolvedDictionaryFilePath = resolveFilePath(dictionaryFilePath, [
            './dictionary.js',
            './dictionary.jsx',
            './dictionary.ts',
            './dictionary.tsx',
            './src/dictionary.js',
            './src/dictionary.jsx',
            './src/dictionary.ts',
            './src/dictionary.tsx'
        ]);
        processDictionaryFile(resolvedDictionaryFilePath, options);
    });

program.parse();

/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
function resolveFilePath(filePath: string, defaultPaths: string[]): string {
    if (filePath) {
        return filePath;
    }

    for (const possiblePath of defaultPaths) {
        if (fs.existsSync(possiblePath)) {
            return possiblePath;
        }
    }

    throw new Error('File not found in default locations.');
}

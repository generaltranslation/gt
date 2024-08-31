#!/usr/bin/env node

import path from 'path';
import React from 'react';
import { program } from 'commander';
import { flattenDictionary, writeChildrenAsObjects, addGTIdentifier } from 'gt-react'
import GT from 'generaltranslation'
import { getLanguageName, isValidLanguageCode, getLanguageCode } from 'generaltranslation';
import fs from 'fs';
import { transformFileSync } from '@babel/core';

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

function loadConfigFile(configFilePath: string): object {
    const absoluteConfigFilePath = path.resolve(configFilePath);
    if (fs.existsSync(absoluteConfigFilePath)) {
        try {
            return require(absoluteConfigFilePath);
        } catch (error) {
            console.error('Failed to load the config file:', error);
            process.exit(1);
        }
    } else {
        throw new Error(`Config file not found: ${absoluteConfigFilePath}`);
    }
}

function applyConfigToBabel(config: any) {
    const babelConfig: Record<string, any> = {
        presets: [
            ["@babel/preset-env", { modules: 'commonjs' }],
            '@babel/preset-react',
            '@babel/preset-typescript'
        ],
        plugins: [
            '@babel/plugin-syntax-dynamic-import',
            'babel-plugin-transform-import-meta',
            ['@babel/plugin-transform-modules-commonjs', { allowTopLevelThis: true }],
            '@babel/plugin-transform-runtime'
        ],
        sourceType: 'unambiguous',
        extensions: ['.js', '.jsx', '.ts', '.tsx']
    };

    if (config.compilerOptions && config.compilerOptions.paths) {
        const moduleResolver = require.resolve('babel-plugin-module-resolver');
        const aliases: any = {};

        for (const [key, value] of Object.entries(config.compilerOptions.paths)) {
            if (Array.isArray(value) && typeof value[0] === 'string') {
                const resolvedPath = path.resolve(process.cwd(), value[0].replace('/*', ''));
                aliases[key.replace('/*', '')] = resolvedPath;
            }
        }

        babelConfig.plugins.push([
            moduleResolver,
            { 
                alias: aliases,
                resolvePath(sourcePath: string, currentFile: string, opts: any) {
                    for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
                        if (sourcePath.startsWith(`${aliasKey}/`)) {
                            const resolvedPath = path.resolve(aliasPath as string, sourcePath.slice(aliasKey.length + 1));
                            const extensions = ['.js', '.jsx', '.ts', '.tsx'];

                            function resolveWithExtensions(basePath: string): string | null {
                                for (const ext of extensions) {
                                    const fullPath = `${basePath}${ext}`;
                                    try {
                                        return fs.realpathSync(fullPath);
                                    } catch (_) {
                                        continue;       
                                    }
                                }
                                return null;
                            }

                            try {
                                return fs.realpathSync(resolvedPath);
                            } catch (err) {
                                const hasExtension = extensions.some(ext => resolvedPath.endsWith(ext));
                                if (!hasExtension) {
                                    const resolvedWithExt = resolveWithExtensions(resolvedPath);
                                    if (resolvedWithExt) {
                                        return resolvedWithExt;
                                    }
                                }
                                throw new Error(`Unable to resolve path: ${resolvedPath}`);
                            }
                        }
                    }
                    return null;
                }
            }
        ]);
    }

    return babelConfig;
}

async function processDictionaryFile(dictionaryFilePath: string, options: {
    apiKey?: string,
    projectID?: string,
    dictionaryName?: string,
    defaultLanguage?: string,
    languages?: string[],
    override?: boolean
}, babelConfig: any) {
    const absoluteDictionaryFilePath = path.resolve(dictionaryFilePath);

    let dictionary;
    try {
        const { code } = transformFileSync(absoluteDictionaryFilePath, babelConfig)!;
        const module: any = { exports: {} };
        new Function('module', 'exports', 'require', code!)(module, module.exports, require);
        dictionary = module.exports.default || module.exports;
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
        .filter(language => language ? true : false);
    const override = options.override ? true : false;
    if (!(apiKey && projectID)) {
        throw new Error('GT_API_KEY and GT_PROJECT_ID environment variables or provided arguments are required.');
    }

    let templateUpdates: any = [];
    for (const key in dictionary) {
        let entry = dictionary[key];
        let metadata: { id: string, dictionaryName?: string, defaultLanguage?: string } = { id: key, dictionaryName };
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
            };
            const entryAsObjects = writeChildrenAsObjects(addGTIdentifier(wrappedEntry)); // simulate gt-react's t() function
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
        console.log('Items in dictionary:', templateUpdates.length)
        const gt = new GT({ apiKey, projectID });
        const sendUpdates = async () => {
            const resultLanguages = await gt.updateRemoteDictionary(templateUpdates, languages, projectID, override);
            if (resultLanguages) {
                console.log(
                    `Remote dictionary updated: ${resultLanguages.length ? true : false}.`,
                    (`Languages: ${resultLanguages.length ? `[${resultLanguages.map((language: string) => `"${getLanguageName(language)}"`).join(', ')}]` + '.' : 'None.'}`),
                    resultLanguages.length ? 'Translations are usually live within a minute.' : '',
                );
            } else {
                throw new Error('500: Internal Server Error.');
            }
        };
        await sendUpdates();
    }

    process.exit(0);

    // ... Rest of the processDictionaryFile function remains the same
}

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
    .option('--config <configFilePath>', 'Specify a path to a tsconfig.json or jsconfig.json file')
    .action((dictionaryFilePath: string, options: {
        apiKey?: string,
        projectID?: string,
        dictionaryName?: string,
        defaultLanguage?: string,
        languages?: string[],
        override?: boolean,
        config?: string
    }) => {
        const resolvedConfigFilePath = resolveFilePath(options.config || '', [
            './tsconfig.json',
            './jsconfig.json',
        ]);

        const config = loadConfigFile(resolvedConfigFilePath);
        const babelConfig = applyConfigToBabel(config);

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
        processDictionaryFile(resolvedDictionaryFilePath, options, babelConfig);
    });

program.parse();
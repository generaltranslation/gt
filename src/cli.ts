#!/usr/bin/env node

import path from 'path';
import React from 'react';
import { program } from 'commander';
import {
  extractEntryMetadata,
  flattenDictionary,
  writeChildrenAsObjects,
  addGTIdentifier,
  calculateHash,
  primitives,
} from 'gt-react/internal';
import GT, {
  getLanguageName,
  isValidLanguageCode,
  getLanguageCode,
  splitStringToContent,
} from 'generaltranslation';
import fs from 'fs';
import esbuild from 'esbuild';
import os from 'os';
import resolveFilePath from './resolveFilePath';
import applyConfigToEsbuild from './applyConfigToESBuild';
import loadConfigFile from './loadConfigFile';
import { extractI18nConfig } from './extractI18NConfig';

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

/**
 * Load GT configuration from gt.config.json and optionally from next.config.* if needed.
 * @param {object} options - Command-line options.
 * @returns {object} - Merged configuration options.
 */
async function loadGTConfig(options: any) {
  let config = {};
  
  // First, attempt to load gt.config.json or the file provided via --config
  const resolvedGTConfigFilePath = resolveFilePath(
    options.config || '',
    ['./gt.config.json']
  );

  if (resolvedGTConfigFilePath) {
    console.log(`Loaded configuration from: ${resolvedGTConfigFilePath}`);
    const configContent = fs.readFileSync(resolvedGTConfigFilePath, 'utf-8');
    config = JSON.parse(configContent);
  } else {
    console.log('gt.config.json not found. Attempting to load next.config.*');
    
    // If gt.config.json isn't found, attempt to load next.config.*
    const resolvedNextConfigFilePath = resolveFilePath(
      '',
      ['./next.config.mjs', './next.config.js', './next.config.ts', './next.config.cjs']
    );
    
    if (resolvedNextConfigFilePath) {
        
        // Read the Next.js configuration file content
        const nextConfigContent = fs.readFileSync(resolvedNextConfigFilePath, 'utf-8');
        
        // Pass the file content directly to extractI18nConfig
        config = extractI18nConfig(nextConfigContent);

    } else {
        console.warn('No Next.js configuration file found. Proceeding with default options.');
    }
      
    return config;
    }
}

/**
 * Process the config options for the dictionary and GT config files.
 * @param {string} dictionaryFilePath - The path to the dictionary file.
 * @param {object} options - The options for processing the dictionary file.
 */
async function processConfigOptions(
  dictionaryFilePath: string,
  options: {
    apiKey?: string;
    projectID?: string;
    dictionaryName?: string;
    defaultLanguage?: string;
    languages?: string[];
    override?: boolean;
    description?: string;
    esbuildConfig?: any;
  }
) {
  const absoluteDictionaryFilePath = path.resolve(dictionaryFilePath);

  // Bundle and transpile the dictionary file using esbuild
  const esbuildOptions = applyConfigToEsbuild(options.esbuildConfig || {});
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

  const dictionary = flattenDictionary(
    dictionaryModule.default || dictionaryModule
  );

  // Load GT configuration
  const config = await loadGTConfig(options);
  
  // Merge GT config options with command-line options
  options = { ...config, ...options };

  return { dictionary, options };
}

/**
 * Construct template updates and send them to the General Translation service.
 * @param {object} dictionary - The processed dictionary object.
 * @param {object} options - The options for processing the dictionary file.
 */
async function constructAndSendUpdates(
  dictionary: any,
  options: {
    apiKey?: string;
    projectID?: string;
    dictionaryName?: string;
    defaultLanguage?: string;
    languages?: string[];
    override?: boolean;
    description?: string;
  }
) {
  const apiKey = options.apiKey || process.env.GT_API_KEY;
  const projectID = options.projectID || process.env.GT_PROJECT_ID;
  const dictionaryName =
    options.dictionaryName || primitives.defaultDictionaryName;
  const defaultLanguage = options.defaultLanguage;
  const languages = (options.languages || [])
    .map((language) =>
      isValidLanguageCode(language) ? language : getLanguageCode(language)
    )
    .filter((language) => (language ? true : false));
  const override = options.override ? true : false;
  const description = options.description;

  if (!(apiKey && projectID)) {
    throw new Error(
      'GT_API_KEY and GT_PROJECT_ID environment variables or provided arguments are required.'
    );
  }

  let templateUpdates: any = [];
  for (const id in dictionary) {
    let { entry, metadata: props } = extractEntryMetadata(dictionary[id]);

    const taggedEntry = addGTIdentifier(entry, props);

    let metadata: Record<string, any> = { id, dictionaryName };
    if (defaultLanguage) {
      metadata.defaultLanguage = defaultLanguage;
    }
    if (description) {
      metadata.description = description;
    }
    let context: string | undefined = props?.context;
    if (context) {
      metadata.context = context;
    }

    if (typeof entry === 'function') {
      entry = entry({});
    }

    const entryAsObjects = writeChildrenAsObjects(taggedEntry);
    metadata.hash = await calculateHash(
      context ? [entryAsObjects, context] : entryAsObjects
    );

    if (typeof entryAsObjects === 'string') {
      templateUpdates.push({
        type: 'react',
        data: {
          children: splitStringToContent(entryAsObjects),
          metadata,
        },
      });
    } else {
      templateUpdates.push({
        type: 'react',
        data: {
          children: entryAsObjects,
          metadata,
        },
      });
    }
  }

  if (templateUpdates.length) {
    console.log('Items in dictionary:', templateUpdates.length);
    const gt = new GT({ apiKey, projectID });
    const resultLanguages = await gt.updateProjectDictionary(
      templateUpdates,
      languages,
      projectID,
      override
    );
    if (resultLanguages) {
      console.log(
        `Remote dictionary "${dictionaryName}" updated: ${
          resultLanguages.length ? true : false
        }.`,
        `Languages: ${
          resultLanguages.length
            ? `[${resultLanguages
                .map((language) => `"${getLanguageName(language)}"`)
                .join(', ')}].`
            : 'None.'
        }`,
        resultLanguages.length
          ? 'Translations are usually live within a minute. Check status: www.generaltranslation.com/dashboard.'
          : ''
      );
    } else {
      throw new Error('500: Internal Server Error.');
    }
  }
}

program
  .name('i18n')
  .description(
    'Process React dictionary files and send translations to General Translation services'
  )
  .version('1.0.0')
  .argument('[dictionaryFilePath]', 'Path to the dictionary file')
  .option('--apiKey <apiKey>', 'Specify your GT API key')
  .option('--projectID <projectID>', 'Specify your GT project ID')
  .option(
    '--dictionaryName <name>',
    'Optionally specify a dictionary name for metadata purposes'
  )
  .option(
    '--languages <languages...>',
    'List of target languages for translation'
  )
  .option('--override', 'Override existing translations')
  .option(
    '--defaultLanguage <defaultLanguage>',
    'Specify a default language code or name for metadata purposes'
  )
  .option(
    '--config <configFilePath>',
    'Specify a path to a gt.config.json file containing GT configuration'
  )
  .option(
    '--esbuildConfig <esbuildConfigFilePath>',
    'Specify a path to a tsconfig.json or jsconfig.json file for esbuild'
  )
  .option(
    '--description <description>',
    'Describe your project. Used to assist translation.',
    ''
  )
  .action(
    (
      dictionaryFilePath: string,
      options: {
        apiKey?: string;
        projectID?: string;
        dictionaryName?: string;
        defaultLanguage?: string;
        languages?: string[];
        override?: boolean;
        config?: string;
        esbuildConfig?: string;
        description?: string;
      }
    ) => {
      // Resolve the esbuild config file path or check default locations
      const resolvedEsbuildConfigFilePath = resolveFilePath(
        options.esbuildConfig || '',
        ['./tsconfig.json', './jsconfig.json']
      );

      // Load and apply the configuration to esbuild
      const esbuildConfig = loadConfigFile(resolvedEsbuildConfigFilePath);

      const resolvedDictionaryFilePath = resolveFilePath(
        dictionaryFilePath,
        [
          './dictionary.js',
          './dictionary.jsx',
          './dictionary.ts',
          './dictionary.tsx',
          './src/dictionary.js',
          './src/dictionary.jsx',
          './src/dictionary.ts',
          './src/dictionary.tsx',
        ],
        true
      );

      const main = async () => {
        let dictionary;

        ({ dictionary, options } = await processConfigOptions(
          resolvedDictionaryFilePath,
          { ...options, esbuildConfig }
        ));

        await constructAndSendUpdates(dictionary, options);
      };

      main().catch((error) => {
        console.error('An error occurred:', error);
        process.exit(1);
      });
    }
  );

program.parse();

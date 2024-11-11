#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dotenv_1 = __importDefault(require("dotenv"));
const loadJSON_1 = __importDefault(require("./fs/loadJSON"));
const findFilepath_1 = __importDefault(require("./fs/findFilepath"));
const parseNextConfig_1 = require("./fs/parseNextConfig");
const createESBuildConfig_1 = __importDefault(require("./config/createESBuildConfig"));
const createDictionaryUpdates_1 = __importDefault(require("./updates/createDictionaryUpdates"));
const createInlineUpdates_1 = __importDefault(require("./updates/createInlineUpdates"));
const generaltranslation_1 = __importStar(require("generaltranslation"));
dotenv_1.default.config({ path: '.env' });
dotenv_1.default.config({ path: '.env.local', override: true });
commander_1.program
    .name('i18n')
    .description('Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.')
    .option('--options <path>', 'Filepath to options JSON file, by default gt.config.json', "./gt.config.json")
    .option('--apiKey <key>', 'API key for General Translation cloud service', process.env.GT_API_KEY)
    .option('--projectID <id>', 'Project ID for the translation service', process.env.GT_PROJECT_ID)
    .option('--tsconfig, --jsconfig <path>', 'Path to jsconfig or tsconfig file', (0, findFilepath_1.default)(['./tsconfig.json', './jsconfig.json']))
    .option('--dictionary <path>', 'Path to dictionary file', (0, findFilepath_1.default)([
    './dictionary.js', './src/dictionary.js',
    './dictionary.json', './src/dictionary.json',
    './dictionary.jsx', './src/dictionary.jsx',
    './dictionary.ts', './src/dictionary.ts',
    './dictionary.tsx', './src/dictionary.tsx'
]))
    .option('--app <path>', "Filepath to the app's source directory, by default ./src || ./app", (0, findFilepath_1.default)(['./src', './app']))
    .option('--defaultLanguage, --defaultLocale <locale>', 'Default locale (e.g., en)')
    .option('--languages, --locales <locales...>', 'Space-separated list of locales (e.g., en fr es)', [])
    .option('--description <description>', 'Description for the project or update')
    .option('--replace', 'Replace existing translations in the remote dictionary', true)
    .option('--inline', 'Include inline <T> tags in addition to dictionary file', true)
    .option('--retranslate', 'Forces a new translation for all content.', false)
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    // ------ SETUP ----- //
    var _a;
    // Consolidate config options
    // options given in command || --options filepath || ./gt.config.json || parsing next.config.js
    // it's alright for any of the options to be undefined at this point
    // --options filepath || gt.config.json
    const gtConfig = (0, loadJSON_1.default)(options.options) || {};
    options = Object.assign(Object.assign({}, gtConfig), options);
    // Error if no API key at this point
    if (!options.apiKey)
        throw new Error('No General Translation API key found. Use the --apiKey flag to provide one.');
    // Warn if apiKey is present in gt.config.json
    if (gtConfig.apiKey) {
        console.warn(`Found apiKey in "${options.options}". Are you sure you want to do this? Make sure your API key is not accidentally exposed, e.g. by putting ${options.options} in .gitignore.`);
    }
    // Check locales
    if (options.defaultLocale && !(0, generaltranslation_1.isValidLanguageCode)(options.defaultLocale))
        throw new Error(`defaultLocale: ${options.defaultLocale} is not a valid locale!`);
    if (options.locales) {
        for (const locale of options.locales) {
            if (!(0, generaltranslation_1.isValidLanguageCode)(locale)) {
                throw new Error(`locales: "${(_a = options === null || options === void 0 ? void 0 : options.locales) === null || _a === void 0 ? void 0 : _a.join()}", ${locale} is not a valid locale!`);
            }
        }
    }
    // Create an esbuild config and error if it doesn't resolve
    let esbuildConfig;
    if (options.jsconfig) {
        const jsconfig = (0, loadJSON_1.default)(options.jsconfig);
        if (!jsconfig)
            throw new Error(`Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`);
        esbuildConfig = (0, createESBuildConfig_1.default)(jsconfig);
    }
    else {
        esbuildConfig = (0, createESBuildConfig_1.default)({});
    }
    // manually parsing next.config.js (or .mjs, .cjs, .ts etc.)
    // not foolproof but can't hurt
    const nextConfigFilepath = (0, findFilepath_1.default)(['./next.config.mjs', './next.config.js', './next.config.ts', './next.config.cjs']);
    if (nextConfigFilepath)
        options = Object.assign(Object.assign({}, (0, parseNextConfig_1.parseNextConfig)(nextConfigFilepath)), options);
    // if there's no existing config file, creates one
    // does not include the API key to avoid exposing it
    // const { apiKey, ...rest } = options;
    // if (options.options) updateConfigFile(rest.options, rest);
    // ---- CREATING UPDATES ---- //
    let updates = [];
    let initialMetadata = Object.assign(Object.assign(Object.assign({}, (options.defaultLocale && { defaultLocale: options.defaultLocale })), (options.locales && { locales: options.locales })), (options.description && { description: options.description }));
    // Parse dictionary with esbuildConfig
    if (options.dictionary) {
        updates = [...updates, ...(yield (0, createDictionaryUpdates_1.default)(options, esbuildConfig))];
    }
    // Scan through project for <T> tags 
    if (options.inline) {
        updates = [...updates, ...(yield (0, createInlineUpdates_1.default)(options))];
    }
    ;
    // Metadata addition and validation
    const idHashMap = new Map();
    updates = updates.map(update => {
        const existingHash = idHashMap.get(update.data.metadata.id);
        if (existingHash) {
            if (existingHash !== update.data.metadata.hash)
                throw new Error(`Hashes don't match on two translations with the same id: ${update.data.metadata.id}. Check your <T id="${update.data.metadata.id}"> tags and make sure you're not accidentally duplicating IDs.`);
        }
        else {
            idHashMap.set(update.data.metadata.id, update.data.metadata.hash);
        }
        update.data.metadata = Object.assign(Object.assign({}, initialMetadata), update.data.metadata);
        return update;
    });
    // Send updates to General Translation API
    if (updates.length) {
        const gt = new generaltranslation_1.default(Object.assign(Object.assign({ apiKey: options.apiKey }, (options.projectID && { projectID: options.projectID })), (options.defaultLocale && { defaultLanguage: options.defaultLocale })));
        const resultLanguages = yield gt.updateDictionary(updates, options.locales, Object.assign({ apiKey: undefined }, options));
        if (resultLanguages) {
            console.log(`Project "${options.projectID}" updated: ${resultLanguages.length ? true : false}.`, `Languages: ${resultLanguages.length
                ? `[${resultLanguages
                    .map((language) => `"${(0, generaltranslation_1.getLanguageName)(language)}"`)
                    .join(', ')}].`
                : 'None.'}`, resultLanguages.length
                ? 'Translations are usually live within a minute. Check status: www.generaltranslation.com/dashboard.'
                : '');
        }
    }
    else {
        throw new Error(`No updates found! Are you sure you're running this command in the right directory?`);
    }
    // Log response
}));
commander_1.program.parse();

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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const react_1 = __importDefault(require("react"));
const commander_1 = require("commander");
const internal_1 = require("gt-react/internal");
const generaltranslation_1 = __importStar(require("generaltranslation"));
const fs_1 = __importDefault(require("fs"));
const esbuild_1 = __importDefault(require("esbuild"));
const os_1 = __importDefault(require("os"));
const extractI18NConfig_1 = require("./extractI18NConfig");
const resolveFilePath_1 = __importDefault(require("./resolveFilePath"));
const applyConfigToESBuild_1 = __importDefault(require("./applyConfigToESBuild"));
const loadConfigFile_1 = __importDefault(require("./loadConfigFile"));
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
/**
 * Process the config options for the dictionary and i18n files.
 * @param {string} dictionaryFilePath - The path to the dictionary file.
 * @param {string} i18nFilePath - The path to the i18n configuration file.
 * @param {object} options - The options for processing the dictionary file.
 */
function processConfigOptions(dictionaryFilePath, i18nFilePath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const absoluteDictionaryFilePath = path_1.default.resolve(dictionaryFilePath);
        // Bundle and transpile the dictionary file using esbuild
        const esbuildOptions = (0, applyConfigToESBuild_1.default)(options.config || {});
        const result = yield esbuild_1.default.build(Object.assign(Object.assign({}, esbuildOptions), { entryPoints: [absoluteDictionaryFilePath], write: false }));
        // Write the bundled code to a temporary file
        const bundledCode = result.outputFiles[0].text;
        const tempFilePath = path_1.default.join(os_1.default.tmpdir(), 'bundled-dictionary.js');
        fs_1.default.writeFileSync(tempFilePath, bundledCode);
        global.React = react_1.default;
        // Load the module using require
        let dictionaryModule;
        try {
            dictionaryModule = require(tempFilePath);
        }
        catch (error) {
            console.error('Failed to load the bundled dictionary code:', error);
            process.exit(1);
        }
        finally {
            // Clean up the temporary file
            fs_1.default.unlinkSync(tempFilePath);
        }
        const dictionary = (0, internal_1.flattenDictionary)(dictionaryModule.default || dictionaryModule);
        if (i18nFilePath) {
            const i18nConfig = (0, extractI18NConfig_1.extractI18nConfig)(i18nFilePath);
            options = Object.assign(Object.assign({}, i18nConfig), options);
        }
        return { dictionary, options };
    });
}
/**
 * Construct template updates and send them to the General Translation service.
 * @param {object} dictionary - The processed dictionary object.
 * @param {object} options - The options for processing the dictionary file.
 */
function constructAndSendUpdates(dictionary, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = options.apiKey || process.env.GT_API_KEY;
        const projectID = options.projectID || process.env.GT_PROJECT_ID;
        const dictionaryName = options.dictionaryName;
        const defaultLanguage = options.defaultLanguage;
        const languages = (options.languages || [])
            .map(language => (0, generaltranslation_1.isValidLanguageCode)(language) ? language : (0, generaltranslation_1.getLanguageCode)(language))
            .filter(language => language ? true : false);
        const override = options.override ? true : false;
        const description = options.description;
        if (!(apiKey && projectID)) {
            throw new Error('GT_API_KEY and GT_PROJECT_ID environment variables or provided arguments are required.');
        }
        let templateUpdates = [];
        for (const id in dictionary) {
            let entry = dictionary[id];
            let metadata = { id, dictionaryName };
            if (defaultLanguage) {
                metadata.defaultLanguage = defaultLanguage;
            }
            if (description) {
                metadata.description = description;
            }
            let props = {};
            if (Array.isArray(entry)) {
                if (typeof entry[1] === 'object') {
                    props = entry[1];
                }
                entry = entry[0];
            }
            if (typeof entry === 'function') {
                entry = entry({});
            }
            if (react_1.default.isValidElement(entry)) {
                let wrappedEntry;
                const { singular, plural, dual, zero, one, two, few, many, other, ranges } = props, tMetadata = __rest(props, ["singular", "plural", "dual", "zero", "one", "two", "few", "many", "other", "ranges"]);
                const pluralProps = Object.fromEntries(Object.entries({ singular, plural, dual, zero, one, two, few, many, other, ranges }).filter(([_, value]) => value !== undefined));
                if (Object.keys(pluralProps).length) {
                    const Plural = (pluralProps) => react_1.default.createElement(react_1.default.Fragment, pluralProps, entry);
                    Plural.gtTransformation = 'plural';
                    wrappedEntry = react_1.default.createElement(Plural, pluralProps, entry);
                }
                else {
                    wrappedEntry = react_1.default.createElement(react_1.default.Fragment, null, entry);
                }
                const entryAsObjects = (0, internal_1.writeChildrenAsObjects)((0, internal_1.addGTIdentifier)(wrappedEntry)); // simulate gt-react's t() function
                const hash = yield (0, internal_1.calculateHash)(tMetadata.context ? [entryAsObjects, tMetadata.context] : entryAsObjects);
                tMetadata.hash = hash;
                templateUpdates.push({
                    type: "react",
                    data: {
                        children: entryAsObjects,
                        metadata: Object.assign(Object.assign({}, metadata), tMetadata)
                    }
                });
            }
            else if (typeof entry === 'string') {
                let content = (0, generaltranslation_1.splitStringToContent)(entry);
                if (Array.isArray(content) && content.length > 1) {
                    entry = content;
                }
                templateUpdates.push({
                    type: "string",
                    data: {
                        content: entry,
                        metadata: Object.assign(Object.assign({}, metadata), props)
                    }
                });
            }
        }
        if (templateUpdates.length) {
            console.log('Items in dictionary:', templateUpdates.length);
            const gt = new generaltranslation_1.default({ apiKey, projectID });
            const resultLanguages = yield gt.updateProjectDictionary(templateUpdates, languages, projectID, override);
            if (resultLanguages) {
                console.log(`Remote dictionary "${dictionaryName}" updated: ${resultLanguages.length ? true : false}.`, `Languages: ${resultLanguages.length ? `[${resultLanguages.map(language => `"${(0, generaltranslation_1.getLanguageName)(language)}"`).join(', ')}]` + '.' : 'None.'}`, resultLanguages.length ? 'Translations are usually live within a minute. Check status: www.generaltranslation.com/dashboard.' : '');
            }
            else {
                throw new Error('500: Internal Server Error.');
            }
        }
    });
}
commander_1.program
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
    .action((dictionaryFilePath, options) => {
    // Resolve the config file path or check default locations
    const resolvedConfigFilePath = (0, resolveFilePath_1.default)(options.config || '', [
        './tsconfig.json',
        './jsconfig.json',
    ]);
    // Load and apply the configuration to esbuild
    const config = (0, loadConfigFile_1.default)(resolvedConfigFilePath);
    const resolvedDictionaryFilePath = (0, resolveFilePath_1.default)(dictionaryFilePath, [
        './dictionary.js',
        './dictionary.jsx',
        './dictionary.ts',
        './dictionary.tsx',
        './src/dictionary.js',
        './src/dictionary.jsx',
        './src/dictionary.ts',
        './src/dictionary.tsx'
    ], true);
    const resolvedI18NFilePath = (0, resolveFilePath_1.default)(options.i18n || '', [
        './i18n.js',
        './i18n.jsx',
        './i18n.ts',
        './i18n.tsx',
        './src/i18n.js',
        './src/i18n.jsx',
        './src/i18n.ts',
        './src/i18n.tsx'
    ]);
    const main = () => __awaiter(void 0, void 0, void 0, function* () {
        let dictionary;
        ({ dictionary, options } = yield processConfigOptions(resolvedDictionaryFilePath, resolvedI18NFilePath, Object.assign(Object.assign({}, options), { config })));
        yield constructAndSendUpdates(dictionary, options);
    });
    main().then(() => process.exit(0));
});
commander_1.program.parse();

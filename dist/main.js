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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const commander_1 = require("commander");
const dotenv_1 = __importDefault(require("dotenv"));
const loadJSON_1 = __importDefault(require("./fs/loadJSON"));
const findFilepath_1 = __importStar(require("./fs/findFilepath"));
const createESBuildConfig_1 = __importDefault(require("./config/createESBuildConfig"));
const createDictionaryUpdates_1 = __importDefault(require("./updates/createDictionaryUpdates"));
const createInlineUpdates_1 = __importDefault(require("./updates/createInlineUpdates"));
const generaltranslation_1 = require("generaltranslation");
const updateConfigFile_1 = __importDefault(require("./fs/updateConfigFile"));
const console_1 = require("./console/console");
const warnings_1 = require("./console/warnings");
const errors_1 = require("./console/errors");
const internal_1 = require("generaltranslation/internal");
const chalk_1 = __importDefault(require("chalk"));
const scanForContent_1 = __importDefault(require("./updates/scanForContent"));
dotenv_1.default.config({ path: '.env' });
dotenv_1.default.config({ path: '.env.local', override: true });
commander_1.program
    .name('translate')
    .description('Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.')
    .option('--options <path>', 'Filepath to options JSON file, by default gt.config.json', './gt.config.json')
    .option('--api-key <key>', 'API key for General Translation cloud service', process.env.GT_API_KEY)
    .option('--project-id <id>', 'Project ID for the translation service', process.env.GT_PROJECT_ID)
    .option('--tsconfig, --jsconfig <path>', 'Path to jsconfig or tsconfig file', (0, findFilepath_1.default)(['./tsconfig.json', './jsconfig.json']))
    .option('--dictionary <path>', 'Path to dictionary file', (0, findFilepath_1.default)([
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
]))
    .option('--src <path>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
    .option('--default-language, --default-locale <locale>', 'Default locale (e.g., en)')
    .option('--languages, --locales <locales...>', 'Space-separated list of locales (e.g., en fr es)', [])
    .option('--inline', 'Include inline <T> tags in addition to dictionary file', true)
    .option('--wrap', 'Wraps all JSX elements in the src directory with a <T> tag, with unique ids', false)
    .option('--ignore-errors', 'Ignore errors encountered while scanning for <T> tags', false)
    .option('--dry-run', 'Dry run, does not send updates to General Translation API', false)
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    (0, console_1.displayAsciiTitle)();
    (0, console_1.displayInitializingText)();
    // ------ SETUP ----- //
    // Consolidate config options
    // options given in command || --options filepath || ./gt.config.json || parsing next.config.js
    // it's alright for any of the options to be undefined at this point
    // --options filepath || gt.config.json
    const gtConfig = (0, loadJSON_1.default)(options.options) || {};
    options = Object.assign(Object.assign({}, gtConfig), options);
    if (!options.baseUrl)
        options.baseUrl = internal_1.defaultBaseUrl;
    // Error if no API key at this point
    if (!options.apiKey)
        throw new Error('No General Translation API key found. Use the --api-key flag to provide one.');
    // Warn if apiKey is present in gt.config.json
    if (gtConfig.apiKey) {
        (0, warnings_1.warnApiKeyInConfig)(options.options);
    }
    // Error if no API key at this point
    if (!options.projectId)
        throw new Error('No General Translation Project ID found. Use the --project-id flag to provide one.');
    (0, console_1.displayProjectId)(options.projectId);
    // Check locales
    if (options.defaultLocale && !(0, generaltranslation_1.isValidLocale)(options.defaultLocale))
        throw new Error(`defaultLocale: ${options.defaultLocale} is not a valid locale!`);
    if (options.locales) {
        for (const locale of options.locales) {
            if (!(0, generaltranslation_1.isValidLocale)(locale)) {
                throw new Error(`locales: "${(_a = options === null || options === void 0 ? void 0 : options.locales) === null || _a === void 0 ? void 0 : _a.join()}", ${locale} is not a valid locale!`);
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
    const { apiKey } = options, rest = __rest(options, ["apiKey"]);
    if (options.options)
        (0, updateConfigFile_1.default)(rest.options, rest);
    // ---- CREATING UPDATES ---- //
    let updates = [];
    let errors = [];
    // Parse dictionary with esbuildConfig
    if (options.dictionary) {
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
        updates = [
            ...updates,
            ...(yield (0, createDictionaryUpdates_1.default)(options, esbuildConfig)),
        ];
    }
    // Scan through project for <T> tags
    if (options.inline) {
        const { updates: newUpdates, errors: newErrors } = yield (0, createInlineUpdates_1.default)(options);
        errors = [...errors, ...newErrors];
        updates = [...updates, ...newUpdates];
    }
    // Metadata addition and validation
    const idHashMap = new Map();
    const duplicateIds = new Set();
    updates = updates.map((update) => {
        const existingHash = idHashMap.get(update.metadata.id);
        if (existingHash) {
            if (existingHash !== update.metadata.hash) {
                errors.push(`Hashes don't match on two translations with the same id: ${chalk_1.default.blue(update.metadata.id)}. Check your ${chalk_1.default.green(`<T id="${chalk_1.default.blue(update.metadata.id)}">`)} tags and make sure you're not accidentally duplicating IDs.`);
                duplicateIds.add(update.metadata.id);
            }
        }
        else {
            idHashMap.set(update.metadata.id, update.metadata.hash);
        }
        return update;
    });
    // Filter out updates with duplicate IDs
    updates = updates.filter((update) => !duplicateIds.has(update.metadata.id));
    if (errors.length > 0) {
        if (options.ignoreErrors) {
            console.log(chalk_1.default.red(`CLI Tool encountered errors while scanning for ${chalk_1.default.green('<T>')} tags.\n`));
            console.log(errors
                .map((error) => chalk_1.default.yellow('• Warning: ') + error + '\n')
                .join(''), chalk_1.default.white(`These ${chalk_1.default.green('<T>')} components will not be translated.\n`));
        }
        else {
            console.log(chalk_1.default.red(`CLI Tool encountered errors while scanning for ${chalk_1.default.green('<T>')} tags.\n`));
            console.log(chalk_1.default.gray('To ignore these errors, re-run with --ignore-errors\n\n'), errors.map((error) => chalk_1.default.red('• Error: ') + error + '\n').join(''));
            process.exit(1);
        }
    }
    if (options.dryRun) {
        process.exit(0);
    }
    // Send updates to General Translation API
    if (updates.length) {
        const { projectId, defaultLocale } = options;
        const globalMetadata = Object.assign(Object.assign({}, (projectId && { projectId })), (defaultLocale && { sourceLocale: defaultLocale }));
        const body = {
            updates,
            locales: options.locales,
            metadata: globalMetadata,
        };
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const loadingInterval = setInterval(() => {
            process.stdout.write(`\r${chalk_1.default.blue(frames[i])} Sending updates to General Translation API...`);
            i = (i + 1) % frames.length;
        }, 80);
        try {
            const response = yield fetch(`${options.baseUrl}/v1/project/translations/update`, {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
                body: JSON.stringify(body),
            });
            clearInterval(loadingInterval);
            process.stdout.write('\n\n'); // New line after loading is done
            if (!response.ok) {
                throw new Error(response.status + '. ' + (yield response.text()));
            }
            const result = yield response.text();
            console.log(chalk_1.default.green('✓ ') + chalk_1.default.green.bold(result));
        }
        catch (error) {
            clearInterval(loadingInterval);
            process.stdout.write('\n');
            console.log(chalk_1.default.red('✗ Failed to send updates'));
            throw error;
        }
    }
    else {
        throw new Error(errors_1.noTranslationsError);
    }
}));
commander_1.program
    .command('scan')
    .description('Scans the project and wraps all JSX elements in the src directory with a <T> tag, with unique ids')
    .option('--src <path>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
    .option('--framework <framework>', 'Framework to use for wrapping JSX elements, by default next', 'next')
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    (0, console_1.displayAsciiTitle)();
    (0, console_1.displayInitializingText)();
    // Determine if the project is a Next.js project by checking dependencies
    const packageJson = (0, loadJSON_1.default)('./package.json');
    if ((_a = packageJson === null || packageJson === void 0 ? void 0 : packageJson.dependencies) === null || _a === void 0 ? void 0 : _a.next) {
        options.framework = 'next';
    }
    else {
        options.framework = 'react';
    }
    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    yield (0, scanForContent_1.default)(options);
}));
commander_1.program.parse();

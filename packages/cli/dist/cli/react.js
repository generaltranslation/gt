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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactCLI = void 0;
// packages/gt-cli-core/src/BaseCLI.ts
const commander_1 = require("commander");
const console_1 = require("../console/console");
const loadJSON_1 = __importDefault(require("../fs/loadJSON"));
const findFilepath_1 = __importStar(require("../fs/findFilepath"));
const createESBuildConfig_1 = __importDefault(require("../react/config/createESBuildConfig"));
const errors_1 = require("../console/errors");
const internal_1 = require("generaltranslation/internal");
const chalk_1 = __importDefault(require("chalk"));
const prompts_1 = require("@inquirer/prompts");
const postProcess_1 = require("../hooks/postProcess");
const fetchTranslations_1 = require("../api/fetchTranslations");
const path_1 = __importDefault(require("path"));
const base_1 = require("./base");
const scanForContent_1 = __importDefault(require("../react/parse/scanForContent"));
const createDictionaryUpdates_1 = __importDefault(require("../react/parse/createDictionaryUpdates"));
const createInlineUpdates_1 = __importDefault(require("../react/parse/createInlineUpdates"));
const utils_1 = require("../fs/utils");
const sendUpdates_1 = require("../api/sendUpdates");
const save_1 = require("../formats/gt/save");
const generateSettings_1 = require("../config/generateSettings");
const saveJSON_1 = require("../fs/saveJSON");
const parseFilesConfig_1 = require("../fs/config/parseFilesConfig");
const fs_1 = __importDefault(require("fs"));
const DEFAULT_TIMEOUT = 600;
const pkg = 'gt-react';
class ReactCLI extends base_1.BaseCLI {
    constructor(library, additionalModules) {
        super(library, additionalModules);
    }
    init() {
        this.setupTranslateCommand();
        this.setupSetupCommand();
        this.setupScanCommand();
        this.setupGenerateSourceCommand();
    }
    execute() {
        super.execute();
    }
    scanForContent(options, framework) {
        return (0, scanForContent_1.default)(options, pkg, framework);
    }
    createDictionaryUpdates(options, dictionaryPath, esbuildConfig) {
        return (0, createDictionaryUpdates_1.default)(options, dictionaryPath, esbuildConfig);
    }
    createInlineUpdates(options) {
        return (0, createInlineUpdates_1.default)(options, pkg);
    }
    setupTranslateCommand() {
        commander_1.program
            .command('translate')
            .description('Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.')
            .option('--config <path>', 'Filepath to config file, by default gt.config.json', (0, findFilepath_1.default)(['gt.config.json']))
            .option('--api-key <key>', 'API key for General Translation cloud service')
            .option('--project-id <id>', 'Project ID for the translation service', (0, utils_1.resolveProjectId)())
            .option('--version-id <id>', 'Version ID for the translation service')
            .option('--tsconfig, --jsconfig <path>', 'Path to jsconfig or tsconfig file', (0, findFilepath_1.default)(['./tsconfig.json', './jsconfig.json']))
            .option('--dictionary <path>', 'Path to dictionary file')
            .option('--src <paths...>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
            .option('--default-language, --default-locale <locale>', 'Default locale (e.g., en)')
            .option('--new, --locales <locales...>', 'Space-separated list of locales (e.g., en fr es)')
            .option('--inline', 'Include inline <T> tags in addition to dictionary file', true)
            .option('--ignore-errors', 'Ignore errors encountered while scanning for <T> tags', false)
            .option('--dry-run', 'Dry run, does not send updates to General Translation API', false)
            .option('--no-wait', 'Do not wait for the updates to be deployed to the CDN before exiting', true // Default value of options.wait
        )
            .option('--publish', 'Publish updates to the CDN.', false // Default value of options.publish
        )
            .option('-t, --translations-dir, --translation-dir <path>', 'Path to directory where translations will be saved. If this flag is not provided, translations will not be saved locally.')
            .option('--timeout <seconds>', 'Timeout in seconds for waiting for updates to be deployed to the CDN', DEFAULT_TIMEOUT.toString())
            .action((options) => this.handleTranslateCommand(options));
    }
    setupGenerateSourceCommand() {
        commander_1.program
            .command('generate')
            .description('Generate a translation file for the source locale. The -t flag must be provided. This command should be used if you are handling your own translations.')
            .option('--src <paths...>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
            .option('--tsconfig, --jsconfig <path>', 'Path to jsconfig or tsconfig file', (0, findFilepath_1.default)(['./tsconfig.json', './jsconfig.json']))
            .option('--dictionary <path>', 'Path to dictionary file')
            .option('--default-language, --default-locale <locale>', 'Source locale (e.g., en)', internal_1.libraryDefaultLocale)
            .option('--inline', 'Include inline <T> tags in addition to dictionary file', true)
            .option('--ignore-errors', 'Ignore errors encountered while scanning for <T> tags', false)
            .option('-t, --translations-dir, --translation-dir <path>', 'Path to directory where translations will be saved. If this flag is not provided, translations will not be saved locally.')
            .action((options) => this.handleGenerateSourceCommand(options));
    }
    setupSetupCommand() {
        commander_1.program
            .command('setup')
            .description('Scans the project and wraps all JSX elements in the src directory with a <T> tag, with unique ids')
            .option('--src <paths...>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
            .option('--config <path>', 'Filepath to config file, by default gt.config.json', (0, findFilepath_1.default)(['gt.config.json']))
            .action((options) => this.handleSetupCommand(options));
    }
    setupScanCommand() {
        commander_1.program
            .command('scan')
            .description('Scans the project and wraps all JSX elements in the src directory with a <T> tag, with unique ids')
            .option('--src <paths...>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
            .option('--config <path>', 'Filepath to config file, by default gt.config.json', (0, findFilepath_1.default)(['gt.config.json']))
            .option('--disable-ids', 'Disable id generation for the <T> tags', false)
            .option('--disable-formatting', 'Disable formatting of edited files', false)
            .action((options) => this.handleScanCommand(options));
    }
    handleGenerateSourceCommand(initOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, console_1.displayAsciiTitle)();
            (0, console_1.displayInitializingText)();
            const settings = (0, generateSettings_1.generateSettings)(initOptions);
            const options = Object.assign(Object.assign({}, initOptions), settings);
            if (!options.dictionary) {
                options.dictionary = (0, findFilepath_1.default)([
                    './dictionary.js',
                    './src/dictionary.js',
                    './dictionary.json',
                    './src/dictionary.json',
                    './dictionary.ts',
                    './src/dictionary.ts',
                ]);
            }
            // User has to provide a dictionary file
            // will not read from settings.files.resolvedPaths.json
            const { updates, errors } = yield this.createUpdates(options, options.dictionary);
            if (errors.length > 0) {
                if (options.ignoreErrors) {
                    console.log(chalk_1.default.red(`CLI tool encountered errors while scanning for ${chalk_1.default.green('<T>')} tags.\n`));
                    console.log(errors
                        .map((error) => chalk_1.default.yellow('• Warning: ') + error + '\n')
                        .join(''), chalk_1.default.white(`These ${chalk_1.default.green('<T>')} components will not be translated.\n`));
                }
                else {
                    console.log(chalk_1.default.red(`CLI tool encountered errors while scanning for ${chalk_1.default.green('<T>')} tags.\n`));
                    console.log(chalk_1.default.gray('To ignore these errors, re-run with --ignore-errors\n\n'), errors.map((error) => chalk_1.default.red('• Error: ') + error + '\n').join(''));
                    process.exit(1);
                }
            }
            // Convert updates to the proper data format
            const newData = {};
            for (const update of updates) {
                const { source, metadata } = update;
                const { hash, id } = metadata;
                if (id) {
                    newData[id] = source;
                }
                else {
                    newData[hash] = source;
                }
            }
            const { resolvedPaths, placeholderPaths } = settings.files;
            // Save source file if files.json is provided
            if (resolvedPaths.json) {
                console.log();
                (0, saveJSON_1.saveJSON)(path_1.default.join(resolvedPaths.json[0], `${settings.defaultLocale}.json`), newData);
                console.log(chalk_1.default.green('Source file saved successfully!\n'));
                // Also save translations (after merging with existing translations)
                for (const locale of settings.locales) {
                    const translationsFile = (0, parseFilesConfig_1.resolveLocaleFiles)(placeholderPaths, locale);
                    if (!translationsFile.json) {
                        continue;
                    }
                    const existingTranslations = (0, loadJSON_1.default)(translationsFile.json[0]);
                    const mergedTranslations = Object.assign(Object.assign({}, newData), existingTranslations);
                    // Filter out keys that don't exist in newData
                    const filteredTranslations = Object.fromEntries(Object.entries(mergedTranslations).filter(([key]) => newData[key]));
                    (0, saveJSON_1.saveJSON)(translationsFile.json[0], filteredTranslations);
                }
                console.log(chalk_1.default.green('Merged translations successfully!\n'));
            }
        });
    }
    handleScanCommand(options) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, console_1.displayAsciiTitle)();
            (0, console_1.displayInitializingText)();
            // Ask user for confirmation using inquirer
            const answer = yield (0, prompts_1.select)({
                message: chalk_1.default.yellow('⚠️  Warning: This operation will modify your source files!\n   Make sure you have committed or stashed your current changes.\n\n   Do you want to continue?'),
                choices: [
                    { value: true, name: 'Yes' },
                    { value: false, name: 'No' },
                ],
                default: true,
            });
            if (!answer) {
                console.log(chalk_1.default.gray('\nOperation cancelled.'));
                process.exit(0);
            }
            // ----- Create a starter gt.config.json file -----
            (0, generateSettings_1.generateSettings)(options);
            // ----- //
            // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
            const { errors, filesUpdated, warnings } = yield this.scanForContent(options, 'react');
            if (errors.length > 0) {
                console.log(chalk_1.default.red('\n✗ Failed to write files:\n'));
                console.log(errors.join('\n'));
            }
            // Format updated files if formatters are available
            if (!options.disableFormatting)
                yield (0, postProcess_1.formatFiles)(filesUpdated);
            console.log(chalk_1.default.green(`\n✓ Success! Added <T> tags and updated ${chalk_1.default.bold(filesUpdated.length)} files:\n`));
            if (filesUpdated.length > 0) {
                console.log(filesUpdated.map((file) => `${chalk_1.default.green('-')} ${file}`).join('\n'));
                console.log();
                console.log(chalk_1.default.green('Please verify the changes before committing.'));
            }
            if (warnings.length > 0) {
                console.log(chalk_1.default.yellow('\n⚠️  Warnings encountered:'));
                console.log(warnings.map((warning) => `${chalk_1.default.yellow('-')} ${warning}`).join('\n'));
            }
        });
    }
    handleSetupCommand(options) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, console_1.displayAsciiTitle)();
            (0, console_1.displayInitializingText)();
            // Ask user for confirmation using inquirer
            const answer = yield (0, prompts_1.select)({
                message: chalk_1.default.yellow(`This operation will prepare your project for internationalization.
        Make sure you have committed or stashed any changes.
        Do you want to continue?`),
                choices: [
                    { value: true, name: 'Yes' },
                    { value: false, name: 'No' },
                ],
                default: true,
            });
            if (!answer) {
                console.log(chalk_1.default.gray('\nOperation cancelled.'));
                process.exit(0);
            }
            const frameworkType = yield (0, prompts_1.select)({
                message: 'What framework are you using?',
                choices: [
                    { value: 'next', name: chalk_1.default.blue('Next.js') },
                    { value: 'vite', name: chalk_1.default.green('Vite + React') },
                    { value: 'gatsby', name: chalk_1.default.magenta('Gatsby') },
                    { value: 'react', name: chalk_1.default.yellow('React') },
                    { value: 'redwood', name: chalk_1.default.red('RedwoodJS') },
                    { value: 'other', name: chalk_1.default.gray('Other') },
                ],
                default: 'next',
            });
            let addGTProvider = false;
            if (frameworkType === 'next') {
                const routerType = yield (0, prompts_1.select)({
                    message: 'Are you using the App router or the Pages router?',
                    choices: [
                        { value: 'pages', name: 'Pages Router' },
                        { value: 'app', name: 'App Router' },
                    ],
                    default: 'pages',
                });
                if (routerType === 'app') {
                    console.log(chalk_1.default.red('\nPlease use gt-next and gt-next-cli instead. gt-react should not be used with the App router.'));
                    process.exit(0);
                }
                addGTProvider = yield (0, prompts_1.select)({
                    message: 'Do you want the setup tool to automatically add the GTProvider component?',
                    choices: [
                        { value: true, name: 'Yes' },
                        { value: false, name: 'No' },
                    ],
                    default: true,
                });
            }
            else if (frameworkType === 'other') {
                console.log(chalk_1.default.red(`\nSorry, at the moment we currently do not support other React frameworks. 
            Please let us know what you would like to see supported at https://github.com/General-Translation/gt-libraries/issues`));
                process.exit(0);
            }
            const selectedFramework = frameworkType === 'next' ? 'next-pages' : 'next-app';
            const includeTId = yield (0, prompts_1.select)({
                message: 'Do you want to include an unique id for each <T> tag?',
                choices: [
                    { value: true, name: 'Yes' },
                    { value: false, name: 'No' },
                ],
                default: true,
            });
            // ----- Create a starter gt.config.json file -----
            (0, generateSettings_1.generateSettings)(options);
            // ----- //
            const mergeOptions = Object.assign(Object.assign({}, options), { disableIds: !includeTId, disableFormatting: true, addGTProvider });
            // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
            const { errors, filesUpdated, warnings } = yield this.scanForContent(mergeOptions, selectedFramework);
            if (errors.length > 0) {
                console.log(chalk_1.default.red('\n✗ Failed to write files:\n'));
                console.log(errors.join('\n'));
            }
            console.log(chalk_1.default.green(`\nSuccess! Added <T> tags and updated ${chalk_1.default.bold(filesUpdated.length)} files:\n`));
            if (filesUpdated.length > 0) {
                console.log(filesUpdated.map((file) => `${chalk_1.default.green('-')} ${file}`).join('\n'));
                console.log();
                console.log(chalk_1.default.green('Please verify the changes before committing.'));
            }
            if (warnings.length > 0) {
                console.log(chalk_1.default.yellow('\nWarnings encountered:'));
                console.log(warnings.map((warning) => `${chalk_1.default.yellow('-')} ${warning}`).join('\n'));
            }
            // Stage only the modified files
            // const { execSync } = require('child_process');
            // for (const file of filesUpdated) {
            //   await execSync(`git add "${file}"`);
            // }
            const formatter = yield (0, postProcess_1.detectFormatter)();
            if (!formatter || filesUpdated.length === 0) {
                return;
            }
            const applyFormatting = yield (0, prompts_1.select)({
                message: `Would you like to auto-format the modified files? ${chalk_1.default.gray(`(${formatter})`)}`,
                choices: [
                    { value: true, name: 'Yes' },
                    { value: false, name: 'No' },
                ],
                default: true,
            });
            // Format updated files if formatters are available
            if (applyFormatting)
                yield (0, postProcess_1.formatFiles)(filesUpdated, formatter);
        });
    }
    handleTranslateCommand(initOptions) {
        const _super = Object.create(null, {
            handleGenericTranslate: { get: () => super.handleGenericTranslate }
        });
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (0, console_1.displayAsciiTitle)();
            (0, console_1.displayInitializingText)();
            const settings = (0, generateSettings_1.generateSettings)(initOptions);
            // First run the base class's handleTranslate method
            const options = Object.assign(Object.assign({}, initOptions), settings);
            if (!options.dryRun) {
                try {
                    yield _super.handleGenericTranslate.call(this, settings);
                    // If the base class's handleTranslate completes successfully, continue with ReactCLI-specific code
                }
                catch (error) {
                    // Continue with ReactCLI-specific code even if base handleTranslate failed
                }
            }
            if (!options.dictionary) {
                options.dictionary = (0, findFilepath_1.default)([
                    './dictionary.js',
                    './src/dictionary.js',
                    './dictionary.json',
                    './src/dictionary.json',
                    './dictionary.ts',
                    './src/dictionary.ts',
                ]);
            }
            let sourceFile;
            // If options.dictionary is provided, use options.dictionary as the source file
            if (options.dictionary) {
                sourceFile = options.dictionary;
            }
            else {
                // If it is not provided, use the first json file in the files object
                const resolvedFiles = options.files.resolvedPaths;
                if (resolvedFiles.json) {
                    sourceFile = resolvedFiles.json[0];
                }
            }
            // Separate defaultLocale from locales
            options.locales = options.locales.filter((locale) => locale !== options.defaultLocale);
            // validate timeout
            const timeout = parseInt(options.timeout);
            if (isNaN(timeout) || timeout < 0) {
                throw new Error(`Invalid timeout: ${options.timeout}. Must be a positive integer.`);
            }
            options.timeout = timeout.toString();
            // ---- CREATING UPDATES ---- //
            const { updates, errors } = yield this.createUpdates(options, sourceFile);
            if (errors.length > 0) {
                if (options.ignoreErrors) {
                    console.log(chalk_1.default.red(`CLI tool encountered errors while scanning for ${chalk_1.default.green('<T>')} tags.\n`));
                    console.log(errors
                        .map((error) => chalk_1.default.yellow('• Warning: ') + error + '\n')
                        .join(''), chalk_1.default.white(`These ${chalk_1.default.green('<T>')} components will not be translated.\n`));
                }
                else {
                    console.log(chalk_1.default.red(`CLI tool encountered errors while scanning for ${chalk_1.default.green('<T>')} tags.\n`));
                    console.log(chalk_1.default.gray('To ignore these errors, re-run with --ignore-errors\n\n'), errors.map((error) => chalk_1.default.red('• Error: ') + error + '\n').join(''));
                    process.exit(1);
                }
            }
            // If files.json is not provided, publish the translations
            if (!((_b = (_a = settings.files) === null || _a === void 0 ? void 0 : _a.resolvedPaths) === null || _b === void 0 ? void 0 : _b.json)) {
                options.publish = true;
            }
            if (options.dryRun) {
                process.exit(0);
            }
            // Send updates to General Translation API
            if (updates.length) {
                // Error if no API key at this point
                if (!settings.apiKey)
                    throw new Error('No General Translation API key found. Use the --api-key flag to provide one.');
                // Error if no projectId at this point
                if (!settings.projectId)
                    throw new Error('No General Translation Project ID found. Use the --project-id flag to provide one.');
                const updateResponse = yield (0, sendUpdates_1.sendUpdates)(updates, Object.assign(Object.assign({}, settings), { publish: options.publish, wait: options.wait, timeout: options.timeout, dataFormat: 'JSX' }));
                const versionId = updateResponse === null || updateResponse === void 0 ? void 0 : updateResponse.versionId;
                // Save translations to local directory if files.json is provided
                if (versionId && options.files.placeholderPaths.json) {
                    console.log();
                    const translations = yield (0, fetchTranslations_1.fetchTranslations)(settings.baseUrl, settings.apiKey, versionId);
                    (0, save_1.saveTranslations)(translations, options.files.placeholderPaths, 'JSX');
                }
            }
            else {
                console.log(chalk_1.default.red(errors_1.noTranslationsError));
                process.exit(0);
            }
        });
    }
    createUpdates(options, sourceDictionary) {
        return __awaiter(this, void 0, void 0, function* () {
            let updates = [];
            let errors = [];
            // Parse dictionary with esbuildConfig
            if (sourceDictionary &&
                fs_1.default.existsSync(sourceDictionary) &&
                fs_1.default.statSync(sourceDictionary).isFile()) {
                if (sourceDictionary.endsWith('.json')) {
                    updates = [
                        ...updates,
                        ...(yield this.createDictionaryUpdates(options, sourceDictionary)),
                    ];
                }
                else {
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
                        ...(yield this.createDictionaryUpdates(options, sourceDictionary, esbuildConfig)),
                    ];
                }
            }
            // Scan through project for <T> tags
            if (options.inline) {
                const { updates: newUpdates, errors: newErrors } = yield this.createInlineUpdates(options);
                errors = [...errors, ...newErrors];
                updates = [...updates, ...newUpdates];
            }
            // Metadata addition and validation
            const idHashMap = new Map();
            const duplicateIds = new Set();
            updates = updates.map((update) => {
                if (!update.metadata.id)
                    return update;
                const existingHash = idHashMap.get(update.metadata.id);
                if (existingHash) {
                    if (existingHash !== update.metadata.hash) {
                        errors.push(`Hashes don't match on two components with the same id: ${chalk_1.default.blue(update.metadata.id)}. Check your ${chalk_1.default.green('<T>')} tags and dictionary entries and make sure you're not accidentally duplicating IDs.`);
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
            return { updates, errors };
        });
    }
}
exports.ReactCLI = ReactCLI;

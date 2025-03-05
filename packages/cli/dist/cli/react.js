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
exports.ReactCLI = void 0;
// packages/gt-cli-core/src/BaseCLI.ts
const commander_1 = require("commander");
const console_1 = require("../console/console");
const loadJSON_1 = __importDefault(require("../fs/loadJSON"));
const findFilepath_1 = __importStar(require("../fs/findFilepath"));
const loadConfig_1 = __importDefault(require("../fs/config/loadConfig"));
const createESBuildConfig_1 = __importDefault(require("../react/config/createESBuildConfig"));
const generaltranslation_1 = require("generaltranslation");
const warnings_1 = require("../console/warnings");
const errors_1 = require("../console/errors");
const internal_1 = require("generaltranslation/internal");
const chalk_1 = __importDefault(require("chalk"));
const prompts_1 = require("@inquirer/prompts");
const waitForUpdates_1 = require("../api/waitForUpdates");
const updateConfig_1 = __importDefault(require("../fs/config/updateConfig"));
const setupConfig_1 = __importDefault(require("../fs/config/setupConfig"));
const postProcess_1 = require("../hooks/postProcess");
const saveTranslations_1 = __importStar(require("../fs/saveTranslations"));
const path_1 = __importDefault(require("path"));
const base_1 = require("./base");
const scanForContent_1 = __importDefault(require("../react/parse/scanForContent"));
const createDictionaryUpdates_1 = __importDefault(require("../react/parse/createDictionaryUpdates"));
const createInlineUpdates_1 = __importDefault(require("../react/parse/createInlineUpdates"));
function resolveProjectId() {
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
const DEFAULT_TIMEOUT = 600;
const pkg = 'gt-react';
class ReactCLI extends base_1.BaseCLI {
    constructor() {
        super();
        this.setupTranslateCommand();
        this.setupSetupCommand();
        this.setupScanCommand();
        this.setupGenerateSourceCommand();
    }
    scanForContent(options, framework) {
        return (0, scanForContent_1.default)(options, pkg, framework);
    }
    createDictionaryUpdates(options, esbuildConfig) {
        return (0, createDictionaryUpdates_1.default)(options, esbuildConfig);
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
            .option('--project-id <id>', 'Project ID for the translation service', resolveProjectId())
            .option('--version-id <id>', 'Version ID for the translation service')
            .option('--tsconfig, --jsconfig <path>', 'Path to jsconfig or tsconfig file', (0, findFilepath_1.default)(['./tsconfig.json', './jsconfig.json']))
            .option('--dictionary <path>', 'Path to dictionary file', (0, findFilepath_1.default)([
            './dictionary.js',
            './src/dictionary.js',
            './dictionary.json',
            './src/dictionary.json',
            './dictionary.ts',
            './src/dictionary.ts',
        ]))
            .option('--src <paths...>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
            .option('--default-language, --default-locale <locale>', 'Default locale (e.g., en)')
            .option('--new, --locales <locales...>', 'Space-separated list of locales (e.g., en fr es)')
            .option('--inline', 'Include inline <T> tags in addition to dictionary file', true)
            .option('--ignore-errors', 'Ignore errors encountered while scanning for <T> tags', false)
            .option('--dry-run', 'Dry run, does not send updates to General Translation API', false)
            .option('--no-wait', 'Do not wait for the updates to be deployed to the CDN before exiting', true // Default value of options.wait
        )
            .option('--no-publish', 'Do not publish updates to the CDN.', true // Default value of options.publish
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
            .option('--dictionary <path>', 'Path to dictionary file', (0, findFilepath_1.default)([
            './dictionary.js',
            './src/dictionary.js',
            './dictionary.json',
            './src/dictionary.json',
            './dictionary.ts',
            './src/dictionary.ts',
        ]))
            .option('--default-language, --default-locale <locale>', 'Source locale (e.g., en)', 'en')
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
    handleGenerateSourceCommand(options) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, console_1.displayAsciiTitle)();
            (0, console_1.displayInitializingText)();
            const { updates, errors } = yield this.createUpdates(options);
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
            // Save source file if translationsDir exists
            if (options.translationsDir) {
                console.log();
                (0, saveTranslations_1.saveSourceFile)(path_1.default.join(options.translationsDir, `${options.defaultLocale || 'en'}.json`), updates);
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
            if (!options.config)
                (0, setupConfig_1.default)('gt.config.json', process.env.GT_PROJECT_ID, '');
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
                    { value: 'vite', name: chalk_1.default.green('Vite') },
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
            if (!options.config)
                options.config = (0, setupConfig_1.default)('gt.config.json', process.env.GT_PROJECT_ID, '');
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
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (0, console_1.displayAsciiTitle)();
            (0, console_1.displayInitializingText)();
            // Load config file
            const gtConfig = initOptions.config
                ? (0, loadConfig_1.default)(initOptions.config)
                : {};
            // merge options
            const options = Object.assign(Object.assign({}, gtConfig), initOptions);
            options.apiKey = options.apiKey || process.env.GT_API_KEY;
            if (!options.baseUrl)
                options.baseUrl = internal_1.defaultBaseUrl;
            // Distinguish between new locales and existing locales
            let additionalLocales = undefined;
            if (!gtConfig.locales) {
                additionalLocales = initOptions.locales;
                options.locales = undefined;
            }
            else {
                options.locales = Array.from(new Set([...gtConfig.locales, ...(initOptions.locales || [])]));
            }
            // Warn if apiKey is present in gt.config.json
            if (gtConfig.apiKey) {
                (0, warnings_1.warnApiKeyInConfig)(options.config);
                process.exit(1);
            }
            if (options.projectId)
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
            if (additionalLocales) {
                for (const locale of additionalLocales) {
                    if (!(0, generaltranslation_1.isValidLocale)(locale)) {
                        throw new Error(`locales: "${additionalLocales === null || additionalLocales === void 0 ? void 0 : additionalLocales.join()}", ${locale} is not a valid locale!`);
                    }
                }
            }
            // validate timeout
            const timeout = parseInt(options.timeout);
            if (isNaN(timeout) || timeout < 0) {
                throw new Error(`Invalid timeout: ${options.timeout}. Must be a positive integer.`);
            }
            options.timeout = timeout.toString();
            // if there's no existing config file, creates one
            // does not include the API key to avoid exposing it
            const { projectId, defaultLocale } = options, rest = __rest(options, ["projectId", "defaultLocale"]);
            if (!options.config)
                (0, setupConfig_1.default)('gt.config.json', projectId, defaultLocale);
            // ---- CREATING UPDATES ---- //
            const { updates, errors } = yield this.createUpdates(options);
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
            if (options.dryRun) {
                process.exit(0);
            }
            // Send updates to General Translation API
            if (updates.length) {
                // Error if no API key at this point
                if (!options.apiKey)
                    throw new Error('No General Translation API key found. Use the --api-key flag to provide one.');
                // Error if no projectId at this point
                if (!options.projectId)
                    throw new Error('No General Translation Project ID found. Use the --project-id flag to provide one.');
                const { apiKey, projectId, defaultLocale } = options;
                const globalMetadata = Object.assign(Object.assign({}, (projectId && { projectId })), (defaultLocale && { sourceLocale: defaultLocale }));
                // If additionalLocales is provided, additionalLocales + project.current_locales will be translated
                // If not, then options.locales will be translated
                // If neither, then project.current_locales will be translated
                const body = Object.assign(Object.assign(Object.assign(Object.assign({ updates }, (options.locales && { locales: options.locales })), (additionalLocales && { additionalLocales })), { metadata: globalMetadata, publish: options.publish }), (options.versionId && { versionId: options.versionId }));
                const spinner = yield (0, console_1.displayLoadingAnimation)('Sending updates to General Translation API...');
                try {
                    const startTime = Date.now();
                    const response = yield fetch(`${options.baseUrl}/v1/project/translations/update`, {
                        method: 'POST',
                        headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
                        body: JSON.stringify(body),
                    });
                    process.stdout.write('\n\n');
                    if (!response.ok) {
                        spinner.fail(yield response.text());
                        process.exit(1);
                    }
                    if (response.status === 204) {
                        spinner.succeed(yield response.text());
                        return;
                    }
                    const { versionId, message, locales } = yield response.json();
                    spinner.succeed(chalk_1.default.green(message));
                    if (options.config)
                        (0, updateConfig_1.default)(Object.assign({ configFilepath: options.config, _versionId: versionId }, (options.locales && { locales: options.locales })));
                    // Wait for translations if wait is true
                    if (options.wait && locales) {
                        console.log();
                        // timeout was validated earlier
                        const timeout = parseInt(options.timeout) * 1000;
                        const result = yield (0, waitForUpdates_1.waitForUpdates)(apiKey, options.baseUrl, versionId, locales, startTime, timeout);
                    }
                    // Save translations to local directory if translationsDir is provided
                    if (options.translationsDir) {
                        console.log();
                        yield (0, saveTranslations_1.default)(options.baseUrl, apiKey, versionId, options.translationsDir);
                    }
                }
                catch (error) {
                    spinner.fail(chalk_1.default.red('Failed to send updates'));
                    throw error;
                }
            }
            else {
                throw new Error(errors_1.noTranslationsError);
            }
        });
    }
    createUpdates(options) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    ...(yield this.createDictionaryUpdates(options, esbuildConfig)),
                ];
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

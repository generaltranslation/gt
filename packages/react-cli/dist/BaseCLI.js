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
exports.BaseCLI = void 0;
// packages/gt-cli-core/src/BaseCLI.ts
const commander_1 = require("commander");
const console_1 = require("./console/console");
const loadJSON_1 = __importDefault(require("./fs/loadJSON"));
const findFilepath_1 = __importStar(require("./fs/findFilepath"));
const loadConfig_1 = __importDefault(require("./fs/config/loadConfig"));
const createESBuildConfig_1 = __importDefault(require("./config/createESBuildConfig"));
const generaltranslation_1 = require("generaltranslation");
const warnings_1 = require("./console/warnings");
const errors_1 = require("./console/errors");
const internal_1 = require("generaltranslation/internal");
const chalk_1 = __importDefault(require("chalk"));
const prompts_1 = require("@inquirer/prompts");
const waitForUpdates_1 = require("./api/waitForUpdates");
const updateConfig_1 = __importDefault(require("./fs/config/updateConfig"));
const setupConfig_1 = __importDefault(require("./fs/config/setupConfig"));
const postProcess_1 = require("./hooks/postProcess");
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
const DEFAULT_TIMEOUT = 300;
class BaseCLI {
    constructor(framework) {
        this.framework = framework;
    }
    initialize() {
        this.setupTranslateCommand();
        this.setupSetupCommand();
        commander_1.program.parse();
    }
    setupTranslateCommand() {
        commander_1.program
            .command('translate')
            .description('Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.')
            .option('--config <path>', 'Filepath to config file, by default gt.config.json', (0, findFilepath_1.default)(['gt.config.json']))
            .option('--api-key <key>', 'API key for General Translation cloud service')
            .option('--project-id <id>', 'Project ID for the translation service', resolveProjectId())
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
            .option('--src <paths...>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
            .option('--default-language, --default-locale <locale>', 'Default locale (e.g., en)')
            .option('--new, --locales <locales...>', 'Space-separated list of locales (e.g., en fr es)')
            .option('--inline', 'Include inline <T> tags in addition to dictionary file', true)
            .option('--wrap', 'Wraps all JSX elements in the src directory with a <T> tag, with unique ids', false)
            .option('--ignore-errors', 'Ignore errors encountered while scanning for <T> tags', false)
            .option('--dry-run', 'Dry run, does not send updates to General Translation API', false)
            .option('--enable-timeout', 'When set to false, will wait for the updates to be deployed to the CDN before exiting', true)
            .option('--timeout <seconds>', 'Timeout in seconds for waiting for updates to be deployed to the CDN', DEFAULT_TIMEOUT.toString())
            .action((options) => this.handleTranslateCommand(options));
    }
    setupSetupCommand() {
        commander_1.program
            .command('setup')
            .description('Scans the project and wraps all JSX elements in the src directory with a <T> tag, with unique ids')
            .option('--src <paths...>', "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(['./src', './app', './pages', './components']))
            .option('--config <path>', 'Filepath to config file, by default gt.config.json', (0, findFilepath_1.default)(['gt.config.json']))
            .option('--disable-ids', 'Disable id generation for the <T> tags', false)
            .option('--disable-formatting', 'Disable formatting of edited files', false)
            .action((options) => this.handleSetupCommand(options));
    }
    handleSetupCommand(options) {
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
            console.log(options.config);
            if (!options.config)
                (0, setupConfig_1.default)('gt.config.json', process.env.GT_PROJECT_ID, '');
            // ----- //
            // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
            const { errors, filesUpdated, warnings } = yield this.scanForContent(options);
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
            // Error if no API key at this point
            if (!options.apiKey)
                throw new Error('No General Translation API key found. Use the --api-key flag to provide one.');
            // Warn if apiKey is present in gt.config.json
            if (gtConfig.apiKey) {
                (0, warnings_1.warnApiKeyInConfig)(options.config);
                process.exit(1);
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
            const { apiKey, projectId, defaultLocale } = options, rest = __rest(options, ["apiKey", "projectId", "defaultLocale"]);
            if (!options.config)
                (0, setupConfig_1.default)('gt.config.json', projectId, defaultLocale);
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
                const { projectId, defaultLocale } = options;
                const globalMetadata = Object.assign(Object.assign({}, (projectId && { projectId })), (defaultLocale && { sourceLocale: defaultLocale }));
                // If additionalLocales is provided, additionalLocales + project.current_locales will be translated
                // If not, then options.locales will be translated
                // If neither, then project.current_locales will be translated
                const body = Object.assign(Object.assign(Object.assign({ updates }, (options.locales && { locales: options.locales })), (additionalLocales && { additionalLocales })), { metadata: globalMetadata });
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
                    if (options.enableTimeout && locales) {
                        console.log();
                        // timeout was validated earlier
                        const timeout = parseInt(options.timeout) * 1000;
                        yield (0, waitForUpdates_1.waitForUpdates)(apiKey, options.baseUrl, versionId, locales, startTime, timeout);
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
}
exports.BaseCLI = BaseCLI;

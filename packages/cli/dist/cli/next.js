"use strict";
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
exports.NextCLI = void 0;
const console_1 = require("../console/console");
const chalk_1 = __importDefault(require("chalk"));
const prompts_1 = require("@inquirer/prompts");
const postProcess_1 = require("../hooks/postProcess");
const findFilepath_1 = __importDefault(require("../fs/findFilepath"));
const scanForContent_1 = __importDefault(require("../next/parse/scanForContent"));
const createInlineUpdates_1 = __importDefault(require("../react/parse/createInlineUpdates"));
const handleInitGT_1 = __importDefault(require("../next/parse/handleInitGT"));
const react_1 = require("./react");
const generateSettings_1 = require("../config/generateSettings");
const pkg = 'gt-next';
class NextCLI extends react_1.ReactCLI {
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
    createInlineUpdates(options) {
        return (0, createInlineUpdates_1.default)(options, pkg);
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
            const routerType = yield (0, prompts_1.select)({
                message: 'Are you using the Next.js App router or the Pages router?',
                choices: [
                    { value: 'app', name: 'App Router' },
                    { value: 'pages', name: 'Pages Router' },
                ],
                default: 'app',
            });
            if (routerType === 'pages') {
                console.log(chalk_1.default.red('\nPlease use gt-react and gt-react-cli instead. gt-next is currently not supported for the Pages router.'));
                process.exit(0);
            }
            const addGTProvider = yield (0, prompts_1.select)({
                message: 'Do you want the setup tool to automatically add the GTProvider component?',
                choices: [
                    { value: true, name: 'Yes' },
                    { value: false, name: 'No' },
                ],
                default: true,
            });
            // Check if they have a next.config.js file
            const nextConfigPath = (0, findFilepath_1.default)([
                './next.config.js',
                './next.config.ts',
                './next.config.mjs',
                './next.config.mts',
            ]);
            if (!nextConfigPath) {
                console.log(chalk_1.default.red('No next.config.js file found.'));
                process.exit(0);
            }
            const addWithGTConfig = yield (0, prompts_1.select)({
                message: `Do you want to automatically add withGTConfig() to your ${nextConfigPath}?`,
                choices: [
                    { value: true, name: 'Yes' },
                    { value: false, name: 'No' },
                ],
                default: true,
            });
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
            const { errors, filesUpdated, warnings } = yield this.scanForContent(mergeOptions, 'next-app');
            if (addWithGTConfig) {
                // Add the withGTConfig() function to the next.config.js file
                const { errors: initGTErrors, filesUpdated: initGTFilesUpdated } = yield (0, handleInitGT_1.default)(nextConfigPath);
                // merge errors and files
                errors.push(...initGTErrors);
                filesUpdated.push(...initGTFilesUpdated);
            }
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
}
exports.NextCLI = NextCLI;

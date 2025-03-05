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
exports.detectFormatter = detectFormatter;
exports.formatFiles = formatFiles;
const fs_1 = __importDefault(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
function detectFormatter() {
    return __awaiter(this, void 0, void 0, function* () {
        // Try Prettier
        try {
            require('prettier');
            return 'prettier';
        }
        catch (_a) { }
        // Try Biome
        try {
            const { execSync } = require('child_process');
            execSync('npx @biomejs/biome --version', { stdio: 'ignore' });
            return 'biome';
        }
        catch (_b) { }
        // Try ESLint
        try {
            require('eslint');
            return 'eslint';
        }
        catch (_c) { }
        return null;
    });
}
function formatFiles(filesUpdated, formatter) {
    return __awaiter(this, void 0, void 0, function* () {
        if (filesUpdated.length === 0)
            return;
        try {
            const detectedFormatter = formatter || (yield detectFormatter());
            if (!detectedFormatter) {
                console.log(chalk_1.default.yellow('\n⚠️  No supported formatter detected'));
                return;
            }
            if (detectedFormatter === 'prettier') {
                console.log(chalk_1.default.gray('\nCleaning up with prettier...'));
                const prettier = require('prettier');
                for (const file of filesUpdated) {
                    const config = yield prettier.resolveConfig(file);
                    const content = yield fs_1.default.promises.readFile(file, 'utf-8');
                    const formatted = yield prettier.format(content, Object.assign(Object.assign({}, config), { filepath: file }));
                    yield fs_1.default.promises.writeFile(file, formatted);
                }
                return;
            }
            if (detectedFormatter === 'biome') {
                console.log(chalk_1.default.gray('\nCleaning up with biome...'));
                try {
                    const { execSync } = require('child_process');
                    execSync(`npx @biomejs/biome format --write ${filesUpdated.map((file) => `"${file}"`).join(' ')}`, {
                        stdio: ['ignore', 'inherit', 'inherit'],
                    });
                }
                catch (error) {
                    console.log(chalk_1.default.yellow('\n⚠️  Biome formatting failed'));
                    if (error instanceof Error) {
                        console.log(chalk_1.default.gray(error.message));
                    }
                }
                return;
            }
            if (detectedFormatter === 'eslint') {
                console.log(chalk_1.default.gray('\nCleaning up with eslint...'));
                const { ESLint } = require('eslint');
                const eslint = new ESLint({
                    fix: true,
                    overrideConfigFile: undefined, // Will use project's .eslintrc
                });
                for (const file of filesUpdated) {
                    const results = yield eslint.lintFiles([file]);
                    yield ESLint.outputFixes(results);
                }
                return;
            }
        }
        catch (e) {
            console.log(chalk_1.default.yellow('\n⚠️  Unable to run code formatter'));
            if (e instanceof Error) {
                console.log(chalk_1.default.gray(e.message));
            }
        }
    });
}

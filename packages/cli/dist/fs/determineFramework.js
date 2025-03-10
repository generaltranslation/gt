"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineLibrary = determineLibrary;
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function determineLibrary() {
    let library = 'base';
    let additionalModules = [];
    try {
        // Get the current working directory (where the CLI is being run)
        const cwd = process.cwd();
        const packageJsonPath = path_1.default.join(cwd, 'package.json');
        // Check if package.json exists
        if (!fs_1.default.existsSync(packageJsonPath)) {
            console.log(chalk_1.default.red('No package.json found in the current directory. Please run this command from the root of your project.'));
            return { library: 'base', additionalModules: [] };
        }
        // Read and parse package.json
        const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = Object.assign(Object.assign({}, packageJson.dependencies), packageJson.devDependencies);
        // Check for gt-next or gt-react in dependencies
        if (dependencies['gt-next']) {
            library = 'gt-next';
        }
        else if (dependencies['gt-react']) {
            library = 'gt-react';
        }
        else if (dependencies['next-intl']) {
            library = 'next-intl';
        }
        else if (dependencies['i18next']) {
            library = 'i18next';
        }
        if (dependencies['i18next-icu']) {
            additionalModules.push('i18next-icu');
        }
        // Fallback to base if neither is found
        return { library, additionalModules };
    }
    catch (error) {
        console.error('Error determining framework:', error);
        return { library: 'base', additionalModules: [] };
    }
}

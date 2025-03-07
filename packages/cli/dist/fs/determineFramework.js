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
    try {
        // Get the current working directory (where the CLI is being run)
        const cwd = process.cwd();
        const packageJsonPath = path_1.default.join(cwd, 'package.json');
        // Check if package.json exists
        if (!fs_1.default.existsSync(packageJsonPath)) {
            console.log(chalk_1.default.red('No package.json found in the current directory. Please run this command from the root of your project.'));
            return 'base';
        }
        // Read and parse package.json
        const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = Object.assign(Object.assign({}, packageJson.dependencies), packageJson.devDependencies);
        // Check for gt-next or gt-react in dependencies
        if (dependencies['gt-next']) {
            return 'gt-next';
        }
        else if (dependencies['gt-react']) {
            return 'gt-react';
        }
        else if (dependencies['next-intl']) {
            return 'next-intl';
        }
        else if (dependencies['react-i18next']) {
            return 'react-i18next';
        }
        else if (dependencies['next-i18next']) {
            return 'next-i18next';
        }
        // Fallback to base if neither is found
        return 'base';
    }
    catch (error) {
        console.error('Error determining framework:', error);
        return 'base';
    }
}

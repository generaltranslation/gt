"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createOrUpdateConfig;
const fs_1 = __importDefault(require("fs"));
const console_1 = require("../../console/console");
/**
 * Checks if the config file exists.
 * If yes, make sure make sure projectId is correct
 * If not, creates a new JSON file at the given filepath and writes the provided config object to it.
 * @param {string} configFilepath - The path to the config file.
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
function createOrUpdateConfig(configFilepath, options) {
    // Filter out empty string values from the config object
    const newContent = Object.assign(Object.assign(Object.assign({}, (options.projectId && { projectId: options.projectId })), (options.defaultLocale && { defaultLocale: options.defaultLocale })), (options.files && { files: options.files }));
    try {
        // if file exists
        let oldContent = {};
        if (fs_1.default.existsSync(configFilepath)) {
            oldContent = JSON.parse(fs_1.default.readFileSync(configFilepath, 'utf-8'));
        }
        // merge old and new content
        const mergedContent = Object.assign(Object.assign({}, oldContent), newContent);
        // Add locales to mergedContent if they exist
        if (options.locales) {
            mergedContent.locales = mergedContent.locales
                ? [...new Set([...mergedContent.locales, ...options.locales])]
                : options.locales;
        }
        // write to file
        const mergedJsonContent = JSON.stringify(mergedContent, null, 2);
        fs_1.default.writeFileSync(configFilepath, mergedJsonContent, 'utf-8');
        // show update in console
        (0, console_1.displayCreatedConfigFile)(configFilepath);
    }
    catch (error) {
        console.error(`An error occurred while updating ${configFilepath}:`, error);
    }
    return configFilepath;
}

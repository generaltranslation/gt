"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = updateConfig;
const fs_1 = __importDefault(require("fs"));
const console_1 = require("../../console/console");
/**
 * Update the config file version id, locales, and projectId (if necessary)
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
function updateConfig(configFilepath, projectId, _versionId, locales) {
    // Filter out empty string values from the config object
    const newContent = Object.assign(Object.assign(Object.assign({}, (projectId && { projectId })), (_versionId && { _versionId })), (locales && { locales }));
    try {
        // if file exists
        let oldContent = {};
        if (fs_1.default.existsSync(configFilepath)) {
            oldContent = JSON.parse(fs_1.default.readFileSync(configFilepath, 'utf-8'));
        }
        // merge old and new content
        const mergedContent = Object.assign(Object.assign({}, oldContent), newContent);
        // write to file
        const mergedJsonContent = JSON.stringify(mergedContent, null, 2);
        fs_1.default.writeFileSync(configFilepath, mergedJsonContent, 'utf-8');
        // show update in console
        (0, console_1.displayUpdatedConfigFile)(configFilepath);
    }
    catch (error) {
        console.error(`An error occurred while updating ${configFilepath}:`, error);
    }
}

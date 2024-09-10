"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = resolveFilePath;
const fs_1 = __importDefault(require("fs"));
/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
function resolveFilePath(filePath, defaultPaths, throwError = false) {
    if (filePath) {
        return filePath;
    }
    for (const possiblePath of defaultPaths) {
        if (fs_1.default.existsSync(possiblePath)) {
            return possiblePath;
        }
    }
    if (throwError) {
        throw new Error('File not found in default locations.');
    }
    return '';
}

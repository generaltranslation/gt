"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = findFilepath;
const fs_1 = __importDefault(require("fs"));
/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
function findFilepath(paths, errorMessage = '') {
    for (const possiblePath of paths) {
        if (fs_1.default.existsSync(possiblePath)) {
            return possiblePath;
        }
    }
    if (errorMessage) {
        throw new Error(errorMessage);
    }
    return '';
}

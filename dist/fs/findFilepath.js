"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = findFilepath;
exports.findFilepaths = findFilepaths;
const fs_1 = __importDefault(require("fs"));
/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
function findFilepath(paths, errorMessage = "") {
    var _a;
    return ((_a = findFilepaths(paths, errorMessage)) === null || _a === void 0 ? void 0 : _a[0]) || "";
}
/**
 * Resolve the file paths from the given file paths or default paths.
 * @param {string[]} paths - The file paths to resolve.
 * @param {string} errorMessage - The error message to throw if no paths are found.
 * @returns {string[]} - The resolved file paths.
 */
function findFilepaths(paths, errorMessage = "") {
    const resolvedPaths = [];
    for (const possiblePath of paths) {
        if (fs_1.default.existsSync(possiblePath)) {
            resolvedPaths.push(possiblePath);
        }
    }
    if (errorMessage) {
        throw new Error(errorMessage);
    }
    return resolvedPaths;
}

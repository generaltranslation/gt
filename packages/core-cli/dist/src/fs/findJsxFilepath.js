"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFiles = getFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Define the file extensions to look for
const extensions = ['.js', '.jsx', '.tsx'];
/**
 * Recursively scan the directory and collect all files with the specified extensions,
 * excluding files or directories that start with a dot (.)
 * @param dir - The directory to scan
 * @returns An array of file paths
 */
function getFiles(dir) {
    let files = [];
    const items = fs_1.default.readdirSync(dir);
    for (const item of items) {
        // Skip hidden files and directories
        if (item.startsWith('.'))
            continue;
        const fullPath = path_1.default.join(dir, item);
        const stat = fs_1.default.statSync(fullPath);
        if (stat.isDirectory()) {
            // Recursively scan subdirectories
            files = files.concat(getFiles(fullPath));
        }
        else if (extensions.includes(path_1.default.extname(item))) {
            // Add files with the specified extensions
            files.push(fullPath);
        }
    }
    return files;
}

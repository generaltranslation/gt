"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = loadJSON;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Loads a JSON file from a given filepath, returning null if the file is not found or the JSON doesn't parse.
 * @param {string} filepath - The path to the JSON file.
 * @returns {Record<string, any> | null} - The parsed JSON object or null if an error occurs.
 */
function loadJSON(filepath) {
    try {
        const data = fs_1.default.readFileSync(path_1.default.resolve(filepath), "utf-8");
        return JSON.parse(data);
    }
    catch (error) {
        // Return null if the file is not found or JSON parsing fails
        return null;
    }
}

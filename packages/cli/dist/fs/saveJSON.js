"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveJSON = saveJSON;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function saveJSON(filepath, data) {
    // Ensure directory exists
    fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
    fs_1.default.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

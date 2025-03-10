"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = loadConfig;
const fs_1 = __importDefault(require("fs"));
function loadConfig(filepath) {
    try {
        return JSON.parse(fs_1.default.readFileSync(filepath, 'utf-8'));
    }
    catch (error) {
        return {};
    }
}

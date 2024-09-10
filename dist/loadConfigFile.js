"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = loadConfigFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function loadConfigFile(configFilePath) {
    const absoluteConfigFilePath = path_1.default.resolve(configFilePath);
    if (fs_1.default.existsSync(absoluteConfigFilePath)) {
        try {
            return require(absoluteConfigFilePath);
        }
        catch (error) {
            console.error('Failed to load the config file:', error);
            process.exit(1);
        }
    }
    else {
        throw new Error(`Config file not found: ${absoluteConfigFilePath}`);
    }
}

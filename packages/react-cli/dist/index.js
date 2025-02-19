"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCLI = exports.ReactCLI = void 0;
exports.default = main;
const BaseCLI_1 = require("./BaseCLI");
Object.defineProperty(exports, "BaseCLI", { enumerable: true, get: function () { return BaseCLI_1.BaseCLI; } });
const scanForContent_1 = __importDefault(require("./updates/scanForContent"));
const createDictionaryUpdates_1 = __importDefault(require("./updates/createDictionaryUpdates"));
const createInlineUpdates_1 = __importDefault(require("./updates/createInlineUpdates"));
const pkg = 'gt-react';
class ReactCLI extends BaseCLI_1.BaseCLI {
    constructor() {
        super();
    }
    scanForContent(options, framework) {
        return (0, scanForContent_1.default)(options, pkg, framework);
    }
    createDictionaryUpdates(options, esbuildConfig) {
        return (0, createDictionaryUpdates_1.default)(options, esbuildConfig);
    }
    createInlineUpdates(options) {
        return (0, createInlineUpdates_1.default)(options, pkg);
    }
}
exports.ReactCLI = ReactCLI;
function main() {
    const cli = new ReactCLI();
    cli.initialize();
}

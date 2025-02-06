"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCLI = exports.NextCLI = void 0;
exports.default = main;
const gt_react_cli_1 = require("gt-react-cli");
Object.defineProperty(exports, "BaseCLI", { enumerable: true, get: function () { return gt_react_cli_1.BaseCLI; } });
const scanForContent_1 = __importDefault(require("gt-react-cli/updates/scanForContent"));
const createDictionaryUpdates_1 = __importDefault(require("gt-react-cli/updates/createDictionaryUpdates"));
const createInlineUpdates_1 = __importDefault(require("gt-react-cli/updates/createInlineUpdates"));
const framework = 'gt-next';
class NextCLI extends gt_react_cli_1.BaseCLI {
    constructor() {
        super(framework);
    }
    scanForContent(options) {
        return (0, scanForContent_1.default)(options, framework);
    }
    createDictionaryUpdates(options, esbuildConfig) {
        return (0, createDictionaryUpdates_1.default)(options, esbuildConfig);
    }
    createInlineUpdates(options) {
        return (0, createInlineUpdates_1.default)(options);
    }
}
exports.NextCLI = NextCLI;
function main() {
    const cli = new NextCLI();
    cli.initialize();
}

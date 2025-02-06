"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCLI = exports.ReactCLI = void 0;
exports.default = main;
const BaseCLI_1 = require("./BaseCLI");
Object.defineProperty(exports, "BaseCLI", { enumerable: true, get: function () { return BaseCLI_1.BaseCLI; } });
class ReactCLI extends BaseCLI_1.BaseCLI {
    constructor() {
        super('gt-react');
    }
}
exports.ReactCLI = ReactCLI;
function main() {
    const cli = new ReactCLI();
    cli.initialize();
}

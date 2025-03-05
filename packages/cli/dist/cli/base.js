"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCLI = void 0;
// packages/gt-cli-core/src/BaseCLI.ts
const commander_1 = require("commander");
class BaseCLI {
    constructor() {
        commander_1.program.parse();
    }
}
exports.BaseCLI = BaseCLI;

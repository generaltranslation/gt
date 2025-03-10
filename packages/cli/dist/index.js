"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCLI = void 0;
exports.default = main;
const base_1 = require("./cli/base");
Object.defineProperty(exports, "BaseCLI", { enumerable: true, get: function () { return base_1.BaseCLI; } });
const next_1 = require("./cli/next");
const react_1 = require("./cli/react");
const determineFramework_1 = require("./fs/determineFramework");
function main() {
    const library = (0, determineFramework_1.determineLibrary)();
    let cli;
    if (library === 'gt-next') {
        cli = new next_1.NextCLI('gt-next');
    }
    else if (library === 'gt-react') {
        cli = new react_1.ReactCLI('gt-react');
    }
    else {
        cli = new base_1.BaseCLI(library);
    }
    cli.init();
    cli.execute();
}

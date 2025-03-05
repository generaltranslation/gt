"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCLI = void 0;
exports.default = main;
const base_1 = require("./cli/base");
Object.defineProperty(exports, "BaseCLI", { enumerable: true, get: function () { return base_1.BaseCLI; } });
const next_1 = require("./cli/next");
const react_1 = require("./cli/react");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function determineFramework() {
    try {
        // Get the current working directory (where the CLI is being run)
        const cwd = process.cwd();
        const packageJsonPath = path.join(cwd, 'package.json');
        // Check if package.json exists
        if (!fs.existsSync(packageJsonPath)) {
            console.log('No package.json found in the current directory.');
            return 'base';
        }
        // Read and parse package.json
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = Object.assign(Object.assign({}, packageJson.dependencies), packageJson.devDependencies);
        // Check for gt-next or gt-react in dependencies
        if (dependencies['gt-next']) {
            return 'next';
        }
        else if (dependencies['gt-react']) {
            return 'react';
        }
        // Fallback to base if neither is found
        return 'base';
    }
    catch (error) {
        console.error('Error determining framework:', error);
        return 'base';
    }
}
function main() {
    const framework = determineFramework();
    let cli;
    if (framework === 'next') {
        cli = new next_1.NextCLI();
    }
    else if (framework === 'react') {
        cli = new react_1.ReactCLI();
    }
    else {
        cli = new base_1.BaseCLI();
    }
    cli.init();
    cli.execute();
}

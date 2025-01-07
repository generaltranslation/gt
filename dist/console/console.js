"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayCreatingNewConfigFile = exports.displayFoundTMessage = exports.displayResolvedPaths = exports.displayProjectId = exports.displayInitializingText = exports.displayAsciiTitle = void 0;
const figlet_1 = __importDefault(require("figlet"));
const displayAsciiTitle = () => console.log('\n' + figlet_1.default.textSync('GT', {
    font: 'Univers'
}));
exports.displayAsciiTitle = displayAsciiTitle;
const displayInitializingText = () => {
    console.log(`General Translation, Inc.` +
        `\nhttps://generaltranslation.com/docs` +
        `\n`);
};
exports.displayInitializingText = displayInitializingText;
const displayProjectId = (projectId) => {
    console.log(`Project ID: ${projectId}\n`);
};
exports.displayProjectId = displayProjectId;
const displayResolvedPaths = (resolvedPaths) => {
    console.log('Resolving path aliases:');
    console.log(resolvedPaths.map(([key, resolvedPath]) => `'${key}' -> '${resolvedPath}'`).join('\n'));
    console.log();
};
exports.displayResolvedPaths = displayResolvedPaths;
const displayFoundTMessage = (file, id) => {
    console.log(`Found <T> component in ${file} with id "${id}"`);
};
exports.displayFoundTMessage = displayFoundTMessage;
const displayCreatingNewConfigFile = (configFilepath) => {
    console.log(`Creating new config file as ${configFilepath}\n`);
};
exports.displayCreatingNewConfigFile = displayCreatingNewConfigFile;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayCreatingNewConfigFile = exports.displayFoundTMessage = exports.displayResolvedPaths = exports.displayProjectId = exports.displayInitializingText = exports.displayAsciiTitle = void 0;
const figlet_1 = __importDefault(require("figlet"));
const chalk_1 = __importDefault(require("chalk"));
const displayAsciiTitle = () => console.log("\n" +
    chalk_1.default.cyan(figlet_1.default.textSync("GT", {
        font: "Univers",
    })));
exports.displayAsciiTitle = displayAsciiTitle;
const displayInitializingText = () => {
    console.log(chalk_1.default.bold.blue("General Translation, Inc.") +
        chalk_1.default.gray("\nhttps://generaltranslation.com/docs") +
        "\n");
};
exports.displayInitializingText = displayInitializingText;
const displayProjectId = (projectId) => {
    console.log(chalk_1.default.yellow(`Project ID: ${chalk_1.default.bold(projectId)}\n`));
};
exports.displayProjectId = displayProjectId;
const displayResolvedPaths = (resolvedPaths) => {
    console.log(chalk_1.default.blue.bold("Resolving path aliases:"));
    console.log(resolvedPaths
        .map(([key, resolvedPath]) => chalk_1.default.gray(`'${chalk_1.default.white(key)}' -> '${chalk_1.default.green(resolvedPath)}'`))
        .join("\n"));
    console.log();
};
exports.displayResolvedPaths = displayResolvedPaths;
const displayFoundTMessage = (file, id) => {
    console.log(`Found ${chalk_1.default.cyan("<T>")} component in ${chalk_1.default.green(file)} with id "${chalk_1.default.yellow(id)}"`);
};
exports.displayFoundTMessage = displayFoundTMessage;
const displayCreatingNewConfigFile = (configFilepath) => {
    console.log(chalk_1.default.blue(`Creating new config file as ${chalk_1.default.green(configFilepath)}\n`));
};
exports.displayCreatingNewConfigFile = displayCreatingNewConfigFile;

#!/usr/bin/env node
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dotenv_1 = __importDefault(require("dotenv"));
const loadJSON_1 = __importDefault(require("./fs/loadJSON"));
const findFilepath_1 = __importStar(require("./fs/findFilepath"));
const createESBuildConfig_1 = __importDefault(require("./config/createESBuildConfig"));
const createDictionaryUpdates_1 = __importDefault(require("./updates/createDictionaryUpdates"));
const createInlineUpdates_1 = __importDefault(require("./updates/createInlineUpdates"));
const generaltranslation_1 = require("generaltranslation");
const updateConfigFile_1 = __importDefault(require("./fs/updateConfigFile"));
const console_1 = require("./console/console");
const warnings_1 = require("./console/warnings");
const errors_1 = require("./console/errors");
const internal_1 = require("generaltranslation/internal");
dotenv_1.default.config({ path: ".env" });
dotenv_1.default.config({ path: ".env.local", override: true });
commander_1.program
    .name("translate")
    .description("Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.")
    .option("--options <path>", "Filepath to options JSON file, by default gt.config.json", "./gt.config.json")
    .option("--apiKey <key>", "API key for General Translation cloud service", process.env.GT_API_KEY)
    .option("--projectId <id>", "Project ID for the translation service", process.env.GT_PROJECT_ID)
    .option("--tsconfig, --jsconfig <path>", "Path to jsconfig or tsconfig file", (0, findFilepath_1.default)(["./tsconfig.json", "./jsconfig.json"]))
    .option("--dictionary <path>", "Path to dictionary file", (0, findFilepath_1.default)([
    "./dictionary.js",
    "./src/dictionary.js",
    "./dictionary.json",
    "./src/dictionary.json",
    "./dictionary.jsx",
    "./src/dictionary.jsx",
    "./dictionary.ts",
    "./src/dictionary.ts",
    "./dictionary.tsx",
    "./src/dictionary.tsx",
]))
    .option("--src <path>", "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components", (0, findFilepath_1.findFilepaths)(["./src", "./app", "./pages", "./components"]))
    .option("--defaultLanguage, --defaultLocale <locale>", "Default locale (e.g., en)")
    .option("--languages, --locales <locales...>", "Space-separated list of locales (e.g., en fr es)", [])
    .option("--replace", "Replace existing translations in the remote dictionary", false)
    .option("--inline", "Include inline <T> tags in addition to dictionary file", true)
    .option("--retranslate", "Forces a new translation for all content.", false)
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    (0, console_1.displayAsciiTitle)();
    (0, console_1.displayInitializingText)();
    // ------ SETUP ----- //
    // Consolidate config options
    // options given in command || --options filepath || ./gt.config.json || parsing next.config.js
    // it's alright for any of the options to be undefined at this point
    // --options filepath || gt.config.json
    const gtConfig = (0, loadJSON_1.default)(options.options) || {};
    options = Object.assign(Object.assign({}, gtConfig), options);
    if (!options.baseUrl)
        options.baseUrl = internal_1.defaultBaseUrl;
    // Error if no API key at this point
    if (!options.apiKey)
        throw new Error("No General Translation API key found. Use the --apiKey flag to provide one.");
    // Warn if apiKey is present in gt.config.json
    if (gtConfig.apiKey) {
        (0, warnings_1.warnApiKeyInConfig)(options.options);
    }
    // Error if no API key at this point
    if (!options.projectId)
        throw new Error("No General Translation Project ID found. Use the --projectId flag to provide one.");
    (0, console_1.displayProjectId)(options.projectId);
    // Check locales
    if (options.defaultLocale && !(0, generaltranslation_1.isValidLocale)(options.defaultLocale))
        throw new Error(`defaultLocale: ${options.defaultLocale} is not a valid locale!`);
    if (options.locales) {
        for (const locale of options.locales) {
            if (!(0, generaltranslation_1.isValidLocale)(locale)) {
                throw new Error(`locales: "${(_a = options === null || options === void 0 ? void 0 : options.locales) === null || _a === void 0 ? void 0 : _a.join()}", ${locale} is not a valid locale!`);
            }
        }
    }
    // // manually parsing next.config.js (or .mjs, .cjs, .ts etc.)
    // // not foolproof but can't hurt
    // const nextConfigFilepath = findFilepath([
    //   "./next.config.mjs",
    //   "./next.config.js",
    //   "./next.config.ts",
    //   "./next.config.cjs",
    // ]);
    // if (nextConfigFilepath)
    //   options = { ...parseNextConfig(nextConfigFilepath), ...options };
    // if there's no existing config file, creates one
    // does not include the API key to avoid exposing it
    const { apiKey } = options, rest = __rest(options, ["apiKey"]);
    if (options.options)
        (0, updateConfigFile_1.default)(rest.options, rest);
    // ---- CREATING UPDATES ---- //
    let updates = [];
    // Parse dictionary with esbuildConfig
    if (options.dictionary) {
        let esbuildConfig;
        if (options.jsconfig) {
            const jsconfig = (0, loadJSON_1.default)(options.jsconfig);
            if (!jsconfig)
                throw new Error(`Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`);
            esbuildConfig = (0, createESBuildConfig_1.default)(jsconfig);
        }
        else {
            esbuildConfig = (0, createESBuildConfig_1.default)({});
        }
        updates = [
            ...updates,
            ...(yield (0, createDictionaryUpdates_1.default)(options, esbuildConfig)),
        ];
    }
    // Scan through project for <T> tags
    if (options.inline) {
        updates = [...updates, ...(yield (0, createInlineUpdates_1.default)(options))];
    }
    // Metadata addition and validation
    const idHashMap = new Map();
    updates = updates.map((update) => {
        const existingHash = idHashMap.get(update.metadata.id);
        if (existingHash) {
            if (existingHash !== update.metadata.hash)
                throw new Error(`Hashes don't match on two translations with the same id: ${update.metadata.id}. Check your <T id="${update.metadata.id}"> tags and make sure you're not accidentally duplicating IDs.`);
        }
        else {
            idHashMap.set(update.metadata.id, update.metadata.hash);
        }
        return update;
    });
    // Send updates to General Translation API
    if (updates.length) {
        const { projectId, defaultLocale } = options;
        const globalMetadata = Object.assign(Object.assign({}, (projectId && { projectId })), (defaultLocale && { sourceLocale: defaultLocale }));
        const body = {
            updates,
            locales: options.locales,
            metadata: globalMetadata,
        };
        const response = yield fetch(`${options.baseUrl}/v1/project/translations/update`, {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json" }, (apiKey && { "x-gt-api-key": apiKey })),
            body: JSON.stringify(body),
        });
        console.log();
        if (!response.ok) {
            throw new Error(response.status + ". " + (yield response.text()));
        }
        const result = yield response.text();
        console.log(result);
    }
    else {
        throw new Error(errors_1.noTranslationsError);
    }
}));
commander_1.program.parse();

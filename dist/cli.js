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
const path_1 = __importDefault(require("path"));
const react_1 = __importDefault(require("react"));
const commander_1 = require("commander");
const gt_react_1 = require("gt-react");
const generaltranslation_1 = __importStar(require("generaltranslation"));
const fs_1 = __importDefault(require("fs"));
const esbuild_1 = __importDefault(require("esbuild"));
const os_1 = __importDefault(require("os"));
const extractI18NConfig_1 = require("./extractI18NConfig");
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
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
function applyConfigToEsbuild(config) {
    const esbuildOptions = {
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'es2021',
        loader: {
            '.js': 'jsx',
            '.jsx': 'jsx',
            '.ts': 'ts',
            '.tsx': 'tsx',
        },
        sourcemap: 'inline',
        external: ['server-only'],
        define: {
            'React': 'global.React'
        },
        plugins: []
    };
    // Add the custom plugin to handle 'server-only' imports
    // Add the custom plugin to handle 'server-only' imports
    // Add the custom plugin to handle 'server-only' imports
    esbuildOptions.plugins.push({
        name: 'ignore-server-only',
        setup(build) {
            build.onResolve({ filter: /^server-only$/ }, () => {
                return {
                    path: 'server-only', // This can be a virtual module name
                    namespace: 'ignore-server-only',
                };
            });
            build.onLoad({ filter: /^server-only$/, namespace: 'ignore-server-only' }, () => {
                return {
                    contents: 'module.exports = {};', // Stubbing out the content
                    loader: 'js',
                };
            });
        },
    });
    if (config.compilerOptions) {
        // console.log('Compiler options found in config:', config.compilerOptions);
        if (config.compilerOptions.paths) {
            const aliases = {};
            // console.log('Found path aliases:', config.compilerOptions.paths);
            for (const [key, value] of Object.entries(config.compilerOptions.paths)) {
                if (Array.isArray(value) && typeof value[0] === 'string') {
                    const resolvedPath = path_1.default.resolve(process.cwd(), value[0].replace('/*', ''));
                    aliases[key.replace('/*', '')] = resolvedPath;
                    console.log(`Resolved alias '${key}' to '${resolvedPath}'`);
                }
            }
            esbuildOptions.plugins = esbuildOptions.plugins || [];
            esbuildOptions.plugins.push({
                name: 'alias',
                setup(build) {
                    build.onResolve({ filter: /.*/ }, args => {
                        for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
                            if (args.path.startsWith(`${aliasKey}/`)) {
                                const resolvedPath = path_1.default.resolve(aliasPath, args.path.slice(aliasKey.length + 1));
                                const extensions = ['.js', '.jsx', '.ts', '.tsx'];
                                function resolveWithExtensions(basePath) {
                                    for (const ext of extensions) {
                                        const fullPath = `${basePath}${ext}`;
                                        try {
                                            const realPath = fs_1.default.realpathSync(fullPath); // Resolve symlink if necessary
                                            // console.log(`Resolved symlink for: ${fullPath} to ${realPath}`);
                                            return realPath;
                                        }
                                        catch (_) {
                                            continue;
                                        }
                                    }
                                    return null;
                                }
                                try {
                                    const realPath = fs_1.default.realpathSync(resolvedPath); // Try without an extension first
                                    // console.log(`Resolved symlink for: ${resolvedPath} to ${realPath}`);
                                    return { path: realPath };
                                }
                                catch (err) {
                                    // Check if the path has an extension
                                    const hasExtension = extensions.some(ext => resolvedPath.endsWith(ext));
                                    if (!hasExtension) {
                                        const resolvedWithExt = resolveWithExtensions(resolvedPath);
                                        if (resolvedWithExt) {
                                            return { path: resolvedWithExt };
                                        }
                                    }
                                    throw new Error(`Unable to resolve path: ${resolvedPath}`);
                                }
                            }
                        }
                    });
                },
            });
        }
    }
    else {
        console.log('No compilerOptions found in the config.');
    }
    return esbuildOptions;
}
/**
 * Process the dictionary file and send updates to General Translation services.
 * @param {string} dictionaryFilePath - The path to the dictionary file.
 * @param {object} options - The options for processing the dictionary file.
 */
function processDictionaryFile(dictionaryFilePath, i18nFilePath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const absoluteDictionaryFilePath = path_1.default.resolve(dictionaryFilePath);
        // Bundle and transpile the dictionary file using esbuild
        const esbuildOptions = applyConfigToEsbuild(options.config || {});
        const result = yield esbuild_1.default.build(Object.assign(Object.assign({}, esbuildOptions), { entryPoints: [absoluteDictionaryFilePath], write: false }));
        // Evaluate the bundled code to get the dictionary module
        // Write the bundled code to a temporary file
        const bundledCode = result.outputFiles[0].text;
        const tempFilePath = path_1.default.join(os_1.default.tmpdir(), 'bundled-dictionary.js');
        fs_1.default.writeFileSync(tempFilePath, bundledCode);
        global.React = react_1.default;
        // Load the module using require
        let dictionaryModule;
        try {
            dictionaryModule = require(tempFilePath);
        }
        catch (error) {
            console.error('Failed to load the bundled dictionary code:', error);
            process.exit(1);
        }
        finally {
            // Clean up the temporary file
            fs_1.default.unlinkSync(tempFilePath);
        }
        const dictionary = (0, gt_react_1.flattenDictionary)(dictionaryModule.default || dictionaryModule);
        // READ i18n.js, and extract the JSON object within the first call to createGT()
        // e.g. createGT({ defaultLocale: 'en-US' }) would return { "defaultLocale": "en-US" }
        if (i18nFilePath) {
            const i18nConfig = (0, extractI18NConfig_1.extractI18nConfig)(i18nFilePath);
            options = Object.assign(Object.assign({}, i18nConfig), options);
        }
        const apiKey = options.apiKey || process.env.GT_API_KEY;
        const projectID = options.projectID || process.env.GT_PROJECT_ID;
        const dictionaryName = options.dictionaryName;
        const defaultLanguage = options.defaultLanguage;
        const languages = (options.languages || [])
            .map(language => (0, generaltranslation_1.isValidLanguageCode)(language) ? language : (0, generaltranslation_1.getLanguageCode)(language))
            .filter(language => language ? true : false);
        const override = options.override ? true : false;
        const description = options.description;
        if (!(apiKey && projectID)) {
            throw new Error('GT_API_KEY and GT_PROJECT_ID environment variables or provided arguments are required.');
        }
        let templateUpdates = [];
        for (const id in dictionary) {
            let entry = dictionary[id];
            let metadata = { id, dictionaryName };
            if (defaultLanguage) {
                metadata.defaultLanguage = defaultLanguage;
            }
            if (description) {
                metadata.description = description;
            }
            let props = {};
            if (Array.isArray(entry)) {
                if (typeof entry[1] === 'object') {
                    props = entry[1];
                }
                entry = entry[0];
            }
            if (react_1.default.isValidElement(entry)) {
                let wrappedEntry;
                const { singular, plural, dual, zero, one, two, few, many, other, ranges } = props, tMetadata = __rest(props, ["singular", "plural", "dual", "zero", "one", "two", "few", "many", "other", "ranges"]);
                const pluralProps = Object.fromEntries(Object.entries({ singular, plural, dual, zero, one, two, few, many, other, ranges }).filter(([_, value]) => value !== undefined));
                if (Object.keys(pluralProps).length) {
                    const Plural = (pluralProps) => react_1.default.createElement(react_1.default.Fragment, pluralProps, entry);
                    Plural.gtTransformation = 'plural';
                    wrappedEntry = react_1.default.createElement(Plural, pluralProps, entry);
                }
                else {
                    wrappedEntry = react_1.default.createElement(react_1.default.Fragment, null, entry);
                }
                ;
                const entryAsObjects = (0, gt_react_1.writeChildrenAsObjects)((0, gt_react_1.addGTIdentifier)(wrappedEntry)); // simulate gt-react's t() function
                const hash = yield (0, gt_react_1.calculateHash)(tMetadata.context ? [entryAsObjects, tMetadata.context] : entryAsObjects);
                console.log(id, '=>', hash);
                tMetadata.hash = hash;
                templateUpdates.push({
                    type: "react",
                    data: {
                        children: entryAsObjects,
                        metadata: Object.assign(Object.assign({}, metadata), tMetadata)
                    }
                });
            }
            else if (typeof entry === 'string') {
                templateUpdates.push({
                    type: "string",
                    data: {
                        content: entry,
                        metadata: Object.assign(Object.assign({}, metadata), props)
                    }
                });
            }
        }
        if (templateUpdates.length) {
            console.log('Items in dictionary:', templateUpdates.length);
            const gt = new generaltranslation_1.default({ apiKey, projectID });
            const sendUpdates = () => __awaiter(this, void 0, void 0, function* () {
                const resultLanguages = yield gt.updateProjectDictionary(templateUpdates, languages, projectID, override);
                if (resultLanguages) {
                    console.log(`Remote dictionary "${dictionaryName}" updated: ${resultLanguages.length ? true : false}.`, (`Languages: ${resultLanguages.length ? `[${resultLanguages.map(language => `"${(0, generaltranslation_1.getLanguageName)(language)}"`).join(', ')}]` + '.' : 'None.'}`), resultLanguages.length ? 'Translations are usually live within a minute. Check status: www.generaltranslation.com/dashboard.' : '');
                }
                else {
                    throw new Error('500: Internal Server Error.');
                }
            });
            yield sendUpdates();
        }
        process.exit(0);
    });
}
/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
function resolveFilePath(filePath, defaultPaths, throwError = false) {
    if (filePath) {
        return filePath;
    }
    for (const possiblePath of defaultPaths) {
        if (fs_1.default.existsSync(possiblePath)) {
            return possiblePath;
        }
    }
    if (throwError) {
        throw new Error('File not found in default locations.');
    }
    return '';
}
commander_1.program
    .name('i18n')
    .description('Process React dictionary files and send translations to General Translation services')
    .version('1.0.0')
    .argument('[dictionaryFilePath]', 'Path to the dictionary file')
    .option('--apiKey <apiKey>', 'Specify your GT API key')
    .option('--projectID <projectID>', 'Specify your GT project ID')
    .option('--dictionaryName <name>', 'Optionally specify a dictionary name for metadata purposes')
    .option('--languages <languages...>', 'List of target languages for translation')
    .option('--override', 'Override existing translations')
    .option('--defaultLanguage <defaultLanguage>', 'Specify a default language code or name for metadata purposes')
    .option('--config <configFilePath>', 'Specify a path to a tsconfig.json or jsconfig.json file')
    .option('--i18n <i18nFilePath>', 'Specify a path to an i18n.js configuration file. Used to automatically set projectID, defaultLanguage (from defaultLocale), languages (from approvedLocales), and dictionaryName', '')
    .option('--description <description>', 'Describe your project. Used to assist translation.', '')
    .action((dictionaryFilePath, options) => {
    // Resolve the config file path or check default locations
    const resolvedConfigFilePath = resolveFilePath(options.config || '', [
        './tsconfig.json',
        './jsconfig.json',
    ]);
    // Load and apply the configuration to esbuild
    const config = loadConfigFile(resolvedConfigFilePath);
    const resolvedDictionaryFilePath = resolveFilePath(dictionaryFilePath, [
        './dictionary.js',
        './dictionary.jsx',
        './dictionary.ts',
        './dictionary.tsx',
        './src/dictionary.js',
        './src/dictionary.jsx',
        './src/dictionary.ts',
        './src/dictionary.tsx'
    ], true);
    const resolvedI18NFilePath = resolveFilePath(options.i18n || '', [
        './i18n.js',
        './i18n.jsx',
        './i18n.ts',
        './i18n.tsx',
        './src/i18n.js',
        './src/i18n.jsx',
        './src/i18n.ts',
        './src/i18n.tsx'
    ]);
    processDictionaryFile(resolvedDictionaryFilePath, resolvedI18NFilePath, Object.assign(Object.assign({}, options), { config }));
});
commander_1.program.parse();

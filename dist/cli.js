#!/usr/bin/env node
"use strict";
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
const generaltranslation_1 = __importDefault(require("generaltranslation"));
const generaltranslation_2 = require("generaltranslation");
const fs_1 = __importDefault(require("fs"));
const core_1 = require("@babel/core");
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
function applyConfigToBabel(config) {
    const babelConfig = {
        presets: [
            ["@babel/preset-env", {
                    modules: 'commonjs',
                    targets: { node: 'current' }
                }],
            '@babel/preset-react',
            '@babel/preset-typescript'
        ],
        plugins: [
            '@babel/plugin-syntax-dynamic-import',
            'babel-plugin-transform-import-meta',
            ['@babel/plugin-transform-modules-commonjs', { allowTopLevelThis: true }],
            '@babel/plugin-transform-runtime'
        ],
        sourceType: 'unambiguous'
    };
    if (config.compilerOptions && config.compilerOptions.paths) {
        const moduleResolver = require.resolve('babel-plugin-module-resolver');
        const aliases = {};
        for (const [key, value] of Object.entries(config.compilerOptions.paths)) {
            if (Array.isArray(value) && typeof value[0] === 'string') {
                const resolvedPath = path_1.default.resolve(process.cwd(), value[0].replace('/*', ''));
                aliases[key.replace('/*', '')] = resolvedPath;
            }
        }
        babelConfig.plugins.push([
            moduleResolver,
            {
                alias: aliases,
                resolvePath(sourcePath, currentFile, opts) {
                    for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
                        if (sourcePath.startsWith(`${aliasKey}/`)) {
                            const resolvedPath = path_1.default.resolve(aliasPath, sourcePath.slice(aliasKey.length + 1));
                            const extensions = ['.js', '.jsx', '.ts', '.tsx'];
                            function resolveWithExtensions(basePath) {
                                for (const ext of extensions) {
                                    const fullPath = `${basePath}${ext}`;
                                    try {
                                        return fs_1.default.realpathSync(fullPath);
                                    }
                                    catch (_) {
                                        continue;
                                    }
                                }
                                return null;
                            }
                            try {
                                return fs_1.default.realpathSync(resolvedPath);
                            }
                            catch (err) {
                                const hasExtension = extensions.some(ext => resolvedPath.endsWith(ext));
                                if (!hasExtension) {
                                    const resolvedWithExt = resolveWithExtensions(resolvedPath);
                                    if (resolvedWithExt) {
                                        return resolvedWithExt;
                                    }
                                }
                                throw new Error(`Unable to resolve path: ${resolvedPath}`);
                            }
                        }
                    }
                    return null;
                }
            }
        ]);
    }
    return babelConfig;
}
function processDictionaryFile(dictionaryFilePath, options, babelConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        const absoluteDictionaryFilePath = path_1.default.resolve(dictionaryFilePath);
        let dictionary;
        try {
            const { code } = (0, core_1.transformFileSync)(absoluteDictionaryFilePath, babelConfig);
            const module = { exports: {} };
            new Function('module', 'exports', 'require', code)(module, module.exports, require);
            dictionary = module.exports.default || module.exports;
        }
        catch (error) {
            console.error('Failed to load the dictionary file:', error);
            process.exit(1);
        }
        dictionary = (0, gt_react_1.flattenDictionary)(dictionary);
        const apiKey = options.apiKey || process.env.GT_API_KEY;
        const projectID = options.projectID || process.env.GT_PROJECT_ID;
        const dictionaryName = options.dictionaryName;
        const defaultLanguage = options.defaultLanguage;
        const languages = (options.languages || [])
            .map(language => (0, generaltranslation_2.isValidLanguageCode)(language) ? language : (0, generaltranslation_2.getLanguageCode)(language))
            .filter(language => language ? true : false);
        const override = options.override ? true : false;
        if (!(apiKey && projectID)) {
            throw new Error('GT_API_KEY and GT_PROJECT_ID environment variables or provided arguments are required.');
        }
        let templateUpdates = [];
        for (const key in dictionary) {
            let entry = dictionary[key];
            let metadata = { id: key, dictionaryName };
            if (defaultLanguage) {
                metadata.defaultLanguage = defaultLanguage;
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
                    type: "intl",
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
                const resultLanguages = yield gt.updateRemoteDictionary(templateUpdates, languages, projectID, override);
                if (resultLanguages) {
                    console.log(`Remote dictionary updated: ${resultLanguages.length ? true : false}.`, (`Languages: ${resultLanguages.length ? `[${resultLanguages.map((language) => `"${(0, generaltranslation_2.getLanguageName)(language)}"`).join(', ')}]` + '.' : 'None.'}`), resultLanguages.length ? 'Translations are usually live within a minute.' : '');
                }
                else {
                    throw new Error('500: Internal Server Error.');
                }
            });
            yield sendUpdates();
        }
        process.exit(0);
        // ... Rest of the processDictionaryFile function remains the same
    });
}
function resolveFilePath(filePath, defaultPaths) {
    if (filePath) {
        return filePath;
    }
    for (const possiblePath of defaultPaths) {
        if (fs_1.default.existsSync(possiblePath)) {
            return possiblePath;
        }
    }
    throw new Error('File not found in default locations.');
}
commander_1.program
    .name('update')
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
    .action((dictionaryFilePath, options) => {
    const resolvedConfigFilePath = resolveFilePath(options.config || '', [
        './tsconfig.json',
        './jsconfig.json',
    ]);
    const config = loadConfigFile(resolvedConfigFilePath);
    const babelConfig = applyConfigToBabel(config);
    const resolvedDictionaryFilePath = resolveFilePath(dictionaryFilePath, [
        './dictionary.js',
        './dictionary.jsx',
        './dictionary.ts',
        './dictionary.tsx',
        './src/dictionary.js',
        './src/dictionary.jsx',
        './src/dictionary.ts',
        './src/dictionary.tsx'
    ]);
    processDictionaryFile(resolvedDictionaryFilePath, options, babelConfig);
});
commander_1.program.parse();

"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createServerTFunction;
var jsx_runtime_1 = require("react/jsx-runtime");
var internal_1 = require("gt-react/internal");
var T_1 = __importDefault(require("./inline/T"));
var getDictionary_1 = __importDefault(require("../dictionary/getDictionary"));
var tx_1 = __importDefault(require("./strings/tx"));
function createServerTFunction(prefixID) {
    var getID = function (id) {
        return prefixID ? "".concat(prefixID, ".").concat(id) : id;
    };
    var dictionary = (0, getDictionary_1.default)();
    return function (id, options, f) {
        id = getID(id);
        // Get entry
        var _a = (0, internal_1.extractEntryMetadata)((0, internal_1.getDictionaryEntry)(dictionary, id)), entry = _a.entry, metadata = _a.metadata;
        // Get variables and variable options
        var variables;
        var variablesOptions;
        if (options) {
            variables = options;
            if (metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions) {
                variablesOptions = metadata.variablesOptions;
            }
        }
        // Handle if the entry is a function
        if (typeof f === 'function') {
            entry = f(options);
        }
        else if (typeof entry === 'function') {
            entry = entry(options);
        }
        if (!entry) {
            console.warn("No entry found for id: \"".concat(id, "\""));
            return undefined;
        }
        if (typeof entry === 'string') {
            return (0, tx_1.default)(entry, {
                id: id,
                variables: variables,
                variablesOptions: variablesOptions
            });
        }
        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    };
}
//# sourceMappingURL=createServerTFunction.js.map
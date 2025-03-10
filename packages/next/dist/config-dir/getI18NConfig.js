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
exports.default = getI18NConfig;
var I18NConfiguration_1 = __importDefault(require("./I18NConfiguration"));
var defaultWithGTConfigProps_1 = __importDefault(require("./props/defaultWithGTConfigProps"));
var createErrors_1 = require("../errors/createErrors");
var internal_1 = require("gt-react/internal");
function getI18NConfig() {
    var _a;
    // Return the singleton instance
    var globalObj = globalThis;
    if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
        return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
    }
    // initGT: Get config from environment
    var I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    if (I18NConfigParams) {
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration_1.default(__assign(__assign({}, defaultWithGTConfigProps_1.default), JSON.parse(I18NConfigParams)));
    }
    else {
        console.warn(createErrors_1.usingDefaultsWarning);
        // no initGT implies:
        //  - not translating at all
        //  - using only default locales
        // Parse: projectId
        var projectId = process.env.GT_PROJECT_ID || '';
        // Parse: apiKey, devApiKey
        var apiKey = void 0, devApiKey = void 0;
        var envApiKey = process.env.GT_API_KEY || '';
        var apiKeyType = (_a = envApiKey === null || envApiKey === void 0 ? void 0 : envApiKey.split('-')) === null || _a === void 0 ? void 0 : _a[1];
        if (apiKeyType === 'api') {
            apiKey = envApiKey;
        }
        else if (apiKeyType === 'dev') {
            devApiKey = envApiKey;
        }
        // Parse: defaultLocale
        // Currently, you have to specify the default locale in the config
        var defaultLocale = defaultWithGTConfigProps_1.default.defaultLocale;
        // Check: in dev, tell them to use initGT to activate translation
        if (process.env.NODE_ENV === 'development') {
            console.warn(createErrors_1.noInitGTWarn);
        }
        // Check: no devApiKey in production
        if (process.env.NODE_ENV === 'production' && devApiKey) {
            throw new Error(createErrors_1.devApiKeyIncludedInProductionError);
        }
        // disable all translation
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration_1.default(__assign(__assign({}, defaultWithGTConfigProps_1.default), { locales: [defaultLocale], renderSettings: internal_1.defaultRenderSettings, apiKey: apiKey, projectId: projectId, devApiKey: devApiKey, runtimeUrl: undefined, cacheUrl: null, loadTranslationType: 'disabled', loadMessagesEnabled: false }));
    }
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
}
//# sourceMappingURL=getI18NConfig.js.map
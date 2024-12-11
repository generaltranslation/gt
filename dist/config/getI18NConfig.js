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
var defaultInitGTProps_1 = __importDefault(require("./props/defaultInitGTProps"));
var createErrors_1 = require("../errors/createErrors");
function getI18NConfig() {
    var globalObj = globalThis;
    if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
        return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
    }
    var I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    if (I18NConfigParams) {
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration_1.default(__assign(__assign({}, defaultInitGTProps_1.default), JSON.parse(I18NConfigParams)));
    }
    else {
        console.warn(createErrors_1.usingDefaultsWarning);
        var projectId = process.env.GT_PROJECT_ID || '';
        if (!projectId)
            console.error(createErrors_1.projectIdMissingError);
        var apiKey = process.env.GT_API_KEY || '';
        if (!apiKey)
            console.error(createErrors_1.APIKeyMissingError);
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration_1.default(__assign(__assign({}, defaultInitGTProps_1.default), { maxConcurrentRequests: defaultInitGTProps_1.default._maxConcurrectRequests, batchInterval: defaultInitGTProps_1.default._batchInterval, apiKey: apiKey, projectId: projectId }));
    }
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
}
;
//# sourceMappingURL=getI18NConfig.js.map
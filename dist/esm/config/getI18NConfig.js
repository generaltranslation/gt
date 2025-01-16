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
import I18NConfiguration from "./I18NConfiguration";
import defaultInitGTProps from "./props/defaultInitGTProps";
import { APIKeyMissingError, projectIdMissingError, usingDefaultsWarning } from "../errors/createErrors";
import { defaultRenderSettings } from "gt-react/internal";
export default function getI18NConfig() {
    var _a;
    var globalObj = globalThis;
    if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
        return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
    }
    var I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    if (I18NConfigParams) {
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration(__assign(__assign({}, defaultInitGTProps), JSON.parse(I18NConfigParams)));
    }
    else {
        console.warn(usingDefaultsWarning);
        var projectId = process.env.GT_PROJECT_ID || '';
        if (!projectId)
            console.error(projectIdMissingError);
        var apiKey = void 0;
        var devApiKey = void 0;
        var envApiKey = process.env.GT_API_KEY || '';
        var apiKeyType = (_a = envApiKey === null || envApiKey === void 0 ? void 0 : envApiKey.split('-')) === null || _a === void 0 ? void 0 : _a[1];
        if (apiKeyType === "api") {
            apiKey = envApiKey;
        }
        else if (apiKeyType === "dev") {
            devApiKey = envApiKey;
        }
        if (!apiKey && !devApiKey)
            console.error(APIKeyMissingError);
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration(__assign(__assign({}, defaultInitGTProps), { renderSettings: defaultRenderSettings, apiKey: apiKey, projectId: projectId, devApiKey: devApiKey }));
    }
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
}
;
//# sourceMappingURL=getI18NConfig.js.map
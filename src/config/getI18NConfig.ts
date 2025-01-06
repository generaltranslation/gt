import I18NConfiguration from "./I18NConfiguration";
import defaultInitGTProps from "./props/defaultInitGTProps";
import { APIKeyMissingError, projectIdMissingError, usingDefaultsWarning } from "../errors/createErrors";
import { defaultRenderSettings } from "gt-react/internal";

export default function getI18NConfig(): I18NConfiguration {
    
    const globalObj = globalThis as any;
    
    if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
        return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
    }

    const I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    
    if (I18NConfigParams) {
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
            ...defaultInitGTProps,
            ...JSON.parse(I18NConfigParams),
        });
    } else {
        console.warn(usingDefaultsWarning);

        const projectId = process.env.GT_PROJECT_ID || '';
        if (!projectId)
            console.error(projectIdMissingError);
        
        let apiKey; let devApiKey;
        const envApiKey = process.env.GT_API_KEY || '';
        const apiKeyType = envApiKey?.split('-')?.[1];
        if (apiKeyType === "api") {
            apiKey = envApiKey; 
        } else if (apiKeyType === "dev") {
            devApiKey = envApiKey;
        }
        if (!apiKey && !devApiKey)
            console.error(APIKeyMissingError);

        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
            ...defaultInitGTProps, 
            renderSettings: defaultRenderSettings,
            apiKey, projectId, devApiKey
        });
    }
    
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
};
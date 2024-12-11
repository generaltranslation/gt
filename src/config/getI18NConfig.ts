import I18NConfiguration from "./I18NConfiguration";
import defaultInitGTProps from "./props/defaultInitGTProps";
import { APIKeyMissingError, projectIdMissingError, usingDefaultsWarning } from "../errors/createErrors";

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
        
        const apiKey = process.env.GT_API_KEY || '';
        if (!apiKey)
            console.error(APIKeyMissingError);

        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
            ...defaultInitGTProps, 
            maxConcurrentRequests: defaultInitGTProps._maxConcurrectRequests,
            batchInterval: defaultInitGTProps._batchInterval,
            apiKey, projectId
        });
    }
    
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
};
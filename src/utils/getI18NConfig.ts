import I18NConfiguration from "../config/I18NConfiguration";
import defaultInitGTProps from "../primitives/defaultInitGTProps";
import getDefaultFromEnv from "./getDefaultFromEnv";

export default function getI18NConfig(): I18NConfiguration {
    
    const globalObj = globalThis as any;
    
    if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
        return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
    }

    const I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    const env = getDefaultFromEnv('NODE_ENV') || '';
    
    if (I18NConfigParams) {
        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
            env,
            ...JSON.parse(I18NConfigParams),
        });
    } else {
        console.warn('Unable to access gt-next configuration. Using defaults.');

        const projectID = process.env.GT_PROJECT_ID || '';
        if (!projectID)
            console.error('Project ID missing! Set projectID as GT_PROJECT_ID...');
        
        const apiKey = process.env.GT_API_KEY || '';
        if (!apiKey)
            console.error("API key is required for automatic translation!...");

        globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
            ...defaultInitGTProps, 
            maxConcurrentRequests: defaultInitGTProps._maxConcurrectRequests,
            batchInterval: defaultInitGTProps._batchInterval,
            apiKey, projectID, env
        });
    }
    
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
};
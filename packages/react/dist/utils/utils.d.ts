import { TaggedElement } from '../types/types';
export declare const middlewareLocaleResetFlagName = "generaltranslation.middleware.locale-reset";
export declare function isValidTaggedElement(target: unknown): target is TaggedElement;
export declare function readAuthFromEnv(projectId?: string, devApiKey?: string): {
    projectId: string;
    devApiKey?: string;
};
//# sourceMappingURL=utils.d.ts.map
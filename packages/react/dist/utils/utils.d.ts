import { TaggedElement, TranslatedContent } from '../types/types';
export declare function isTranslatedContent(target: unknown): target is TranslatedContent;
export declare function isValidTaggedElement(target: unknown): target is TaggedElement;
export declare function readAuthFromEnv(projectId?: string, devApiKey?: string): {
    projectId: string;
    devApiKey?: string;
};
//# sourceMappingURL=utils.d.ts.map
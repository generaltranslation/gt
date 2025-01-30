import { RenderMethod, TranslateChildrenCallback, TranslateContentCallback } from '../../types/types';
export default function useRuntimeTranslation({ targetLocale, projectId, devApiKey, runtimeUrl, defaultLocale, renderSettings, setTranslations, ...metadata }: {
    targetLocale: string;
    projectId?: string;
    defaultLocale?: string;
    devApiKey?: string;
    runtimeUrl?: string;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    setTranslations: React.Dispatch<React.SetStateAction<any>>;
    [key: string]: any;
}): {
    translationEnabled: boolean;
    translateContent: TranslateContentCallback;
    translateChildren: TranslateChildrenCallback;
};
//# sourceMappingURL=useRuntimeTranslation.d.ts.map
import { RenderMethod, TranslateChildrenCallback, TranslateContentCallback } from '../../types/types';
export default function useRuntimeTranslation({ projectId, devApiKey, locale, _versionId, defaultLocale, runtimeUrl, renderSettings, setTranslations, ...metadata }: {
    projectId?: string;
    devApiKey?: string;
    locale: string;
    _versionId?: string;
    defaultLocale?: string;
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
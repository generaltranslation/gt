import * as React from 'react';
import { RenderMethod } from '../../types/types';
import { TranslateContentCallback, TranslateChildrenCallback } from '../../types/runtime';
export default function useRuntimeTranslation({ projectId, devApiKey, locale, versionId, defaultLocale, runtimeUrl, renderSettings, setTranslations, runtimeTranslationEnabled, ...globalMetadata }: {
    projectId?: string;
    devApiKey?: string;
    locale: string;
    versionId?: string;
    defaultLocale?: string;
    runtimeUrl?: string | null;
    runtimeTranslationEnabled: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    setTranslations: React.Dispatch<React.SetStateAction<any>>;
    [key: string]: any;
}): {
    registerContentForTranslation: TranslateContentCallback;
    registerJsxForTranslation: TranslateChildrenCallback;
};
//# sourceMappingURL=useRuntimeTranslation.d.ts.map
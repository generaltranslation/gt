'use client'

import { Num } from "gt-react";
import { Suspense, useEffect, useState } from "react";

export default function ClientResolver({
  promise,
  loadingFallback,
  errorFallback,
  renderTranslation,
}: any) {

    const [translationData, setTranslationData] = useState(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const resolvedPromise = await promise;
                setTranslationData(resolvedPromise);
            } catch (error) {
                console.error(error);
                setHasError(true);
            }
        })();
    }, [promise]);

    if (hasError) {
        return errorFallback;
    }

    if (translationData) {
        return renderTranslation(translationData);
    }

    // the <Suspense> here is to prevent hydration errors
    return (
        <Suspense fallback={loadingFallback}>
            {loadingFallback}
        </Suspense>
    );
}

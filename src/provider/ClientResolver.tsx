'use client'

import { Suspense, useEffect, useState } from "react";
import { renderingError } from "../errors/createErrors";

export default function ClientResolver({
  promise,
  loadingFallback,
  errorFallback,
  renderTranslation,
}: any) {

    const [translationData, setTranslationData] = useState(undefined);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const resolvedPromise = await promise;
                setTranslationData(resolvedPromise);
            } catch (error) {
                console.error(renderingError, error);
                setHasError(true);
            }
        })();
    }, [promise]);

    if (hasError) {
        return errorFallback;
    }

    if (typeof translationData !== 'undefined') {
        return (
            <Suspense fallback={errorFallback}>
                {renderTranslation(translationData)}
            </Suspense>
        )
    }

    // the <Suspense> here is to prevent hydration errors
    return (
        <Suspense fallback={loadingFallback}>
            {loadingFallback}
        </Suspense>
    );
}
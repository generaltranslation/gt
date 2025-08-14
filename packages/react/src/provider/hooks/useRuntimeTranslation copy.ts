import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  dynamicTranslationError,
  createGenericRuntimeTranslationError,
  runtimeTranslationTimeoutWarning,
} from '../../errors/createErrors';
import {
  RenderMethod,
  TranslatedChildren,
  Translations,
} from '../../types/types';

import {
  TranslateIcuCallback,
  TranslateChildrenCallback,
  TranslateI18nextCallback,
} from '../../types/runtime';
import { JsxChildren } from 'generaltranslation/internal';
import {
  maxConcurrentRequests,
  maxBatchSize,
  batchInterval,
} from '../config/defaultProps';
import { DataFormat } from 'generaltranslation/types';
import { GT } from 'generaltranslation';

// Queue to store requested keys between renders.
type TranslationRequestMetadata = {
  hash: string;
  context?: string;
  [attr: string]: any;
};
type TranslationRequestQueueItem = (
  | {
      dataFormat: 'ICU' | 'I18NEXT';
      source: string;
    }
  | {
      dataFormat: 'JSX';
      source: JsxChildren;
    }
) & {
  metadata: TranslationRequestMetadata;
  resolve: any;
  reject: any;
};

export default function useRuntimeTranslation({
  gt,
  locale,
  versionId,
  defaultLocale,
  runtimeUrl,
  renderSettings,
  setTranslations,
  ...globalMetadata
}: {
  gt: GT;
  locale: string;
  versionId?: string;
  defaultLocale?: string;
  runtimeUrl?: string | null;
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  setTranslations: React.Dispatch<React.SetStateAction<Translations | null>>;
  [key: string]: any;
}): {
  registerI18nextForTranslation: TranslateI18nextCallback;
  registerIcuForTranslation: TranslateIcuCallback;
  registerJsxForTranslation: TranslateChildrenCallback;
  runtimeTranslationEnabled: boolean;
} {
  // ------ EARLY RETURN IF DISABLED ----- //

  // Translation at runtime during development is enabled
  const runtimeTranslationEnabled = !!(
    gt.projectId &&
    runtimeUrl &&
    gt.devApiKey &&
    process.env.NODE_ENV === 'development'
  );

  if (!runtimeTranslationEnabled)
    return {
      runtimeTranslationEnabled,
      registerI18nextForTranslation: () =>
        Promise.reject(
          new Error(
            'registerI18nextForTranslation() failed because translation is disabled'
          )
        ),
      registerIcuForTranslation: () =>
        Promise.reject(
          new Error(
            'registerIcuForTranslation() failed because translation is disabled'
          )
        ),
      registerJsxForTranslation: () =>
        Promise.reject(
          new Error(
            'registerJsxForTranslation() failed because translation is disabled'
          )
        ),
    };

  // ----- SETUP ----- //

  globalMetadata = {
    ...globalMetadata,
    projectId: gt.projectId,
    sourceLocale: defaultLocale,
  };

  const [activeRequests, setActiveRequests] = useState(0);

  // Requests waiting to be sent
  const requestQueueRef = useRef<Map<string, TranslationRequestQueueItem>>(
    new Map()
  );
  // Requests that have yet to be resolved
  const pendingRequestQueueRef = useRef<
    Map<string, Promise<TranslatedChildren>>
  >(new Map());

  useEffect(() => {
    // remove all pending requests
    requestQueueRef.current.forEach((item) => item.resolve());
    requestQueueRef.current.clear();
  }, [locale]);

  // ----- DEFINE FUNCTIONS ----- //

  const {
    i18next: registerI18nextForTranslation,
    icu: registerIcuForTranslation,
    jsx: registerJsxForTranslation,
  } = useMemo(() => {
    const createTranslationRegistrationFunction = <T extends DataFormat>(
      dataFormat: T
    ) => {
      return (params: {
        source: T extends 'I18NEXT'
          ? Parameters<TranslateI18nextCallback>[0]['source']
          : T extends 'ICU'
            ? Parameters<TranslateIcuCallback>[0]['source']
            : T extends 'JSX'
              ? Parameters<TranslateChildrenCallback>[0]['source']
              : never;
        targetLocale: string;
        metadata: TranslationRequestMetadata;
      }): Promise<TranslatedChildren> => {
        // Get the key, which is a combination of hash and locale
        const key = `${params.metadata.hash}:${params.targetLocale}`;

        // Return a promise to current request if it exists
        const pendingRequest = pendingRequestQueueRef.current.get(key);
        if (pendingRequest) {
          return pendingRequest;
        }

        // Promise for hooking into the translation request to know when complete
        const translationPromise = new Promise<TranslatedChildren>(
          (resolve, reject) => {
            requestQueueRef.current.set(
              key,
              dataFormat === 'JSX'
                ? {
                    dataFormat: 'JSX' as const,
                    source: params.source as JsxChildren,
                    metadata: params.metadata,
                    resolve,
                    reject,
                  }
                : {
                    dataFormat: dataFormat as 'ICU' | 'I18NEXT',
                    source: params.source as string,
                    metadata: params.metadata,
                    resolve,
                    reject,
                  }
            );
          }
        )
          .catch((error) => {
            throw error;
          })
          .finally(() => {
            pendingRequestQueueRef.current.delete(key);
          });

        pendingRequestQueueRef.current.set(key, translationPromise);
        return translationPromise;
      };
    };
    return {
      i18next: createTranslationRegistrationFunction('I18NEXT'),
      icu: createTranslationRegistrationFunction('ICU'),
      jsx: createTranslationRegistrationFunction('JSX'),
    };
  }, []); // refs are stable so don't need to be included in dep array

  // ----- DEFINE FUNCTIONS ----- //

  // Send a request to the runtime server
  const sendBatchRequest = useCallback(
    async (batchRequests: Map<string, TranslationRequestQueueItem>) => {
      if (requestQueueRef.current.size === 0) {
        return [{}, {}];
      }

      // increment active requests
      setActiveRequests((prev) => prev + 1);

      const requests = Array.from(batchRequests.values());
      const newTranslations: Translations = {};

      try {

        // ----- RUNTIME TRANSLATION ----- //

        const results = await gt.translateMany(requests, {
          ...globalMetadata,
          targetLocale: locale,
        });

        // ----- PARSE RESPONSE ----- //

        // process each result
        results.forEach((result, index) => {
          const request = requests[index];
          const hash = request.metadata.hash; // identical to reference hash

          // translation received
          if ('translation' in result) {
            // set translation
            newTranslations[hash] = result.translation;
            return result.translation;
          }

          // translation failure
          if ('error' in result) {
            // 0 and '' are falsey
            // log error message
            console.error(
              createGenericRuntimeTranslationError(
                request.metadata.id,
                request.metadata.hash
              ),
              result.error || 'An upstream error occurred.'
            );
            // set error in translation object
            newTranslations[hash] = null;
            return null;
          }

          // unknown error
          console.error(
            createGenericRuntimeTranslationError(
              request.metadata.id,
              request.metadata.hash
            ),
            result
          );
        });
      } catch (error) {
        // log error
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(runtimeTranslationTimeoutWarning);
        } else {
          console.error(dynamicTranslationError, error);
        }

        // add error message to all translations from this request
        requests.forEach((request) => {
          // id defaults to hash if none provided
          newTranslations[request.metadata.hash] = null;
        });
      } finally {
        // decrement active requests
        setActiveRequests((prev) => prev - 1);

        // resolve all promises
        requests.forEach((request) => {
          request.resolve(newTranslations[request.metadata.hash]);
        });

        // return the new translations
        return [newTranslations];
      }
    },
    [
      runtimeUrl,
      gt.projectId,
      gt.devApiKey,
      locale,
      globalMetadata,
      versionId,
      renderSettings.timeout,
    ]
  );

  // Create a ref to hold the latest activeRequests value.
  const activeRequestsRef = useRef(activeRequests);

  // Update the ref whenever activeRequests changes.
  useEffect(() => {
    activeRequestsRef.current = activeRequests;
  }, [activeRequests]);

  useEffect(() => {
    let storeResults = true;
    const intervalId = setInterval(() => {
      // Use the ref value for the current activeRequests
      if (
        requestQueueRef.current.size > 0 &&
        activeRequestsRef.current < maxConcurrentRequests
      ) {
        const batchSize = Math.min(maxBatchSize, requestQueueRef.current.size);
        const batchRequests = new Map(
          Array.from(requestQueueRef.current.entries()).slice(0, batchSize)
        );
        (async () => {
          // Update the translation result
          const [batchResult, batchStatus] =
            await sendBatchRequest(batchRequests);
          if (storeResults) {
            setTranslations((prev) => ({
              ...(prev || {}),
              ...batchResult,
            }));
          }
        })();
        batchRequests.forEach((_, key) => requestQueueRef.current.delete(key));
      }
    }, batchInterval);

    return () => {
      storeResults = false;
      clearInterval(intervalId);
    };
  }, [locale]);

  return {
    runtimeTranslationEnabled,
    registerI18nextForTranslation,
    registerIcuForTranslation,
    registerJsxForTranslation,
  };
}

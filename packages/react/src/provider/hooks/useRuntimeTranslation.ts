import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
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
} from '../../types/runtime';
import { JsxChildren } from 'generaltranslation/internal';
import {
  maxConcurrentRequests,
  maxBatchSize,
  batchInterval,
} from '../config/defaultProps';
import { DataFormat } from 'generaltranslation/types';
import { GT } from 'generaltranslation';
import { maxTimeout } from 'generaltranslation/internal';

// Queue to store requested keys between renders.
type TranslationRequestMetadata = {
  hash: string;
  context?: string;
  [attr: string]: any;
};
type TranslationRequestQueueItem = (
  | {
      dataFormat: 'ICU';
      source: string;
    }
  | {
      dataFormat: 'JSX';
      source: JsxChildren;
    }
) & {
  metadata: TranslationRequestMetadata;
  resolve: (value: TranslatedChildren) => void;
  reject: (error: any) => void;
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

  // Create refs to track active requests and queues
  const activeRequestsRef = useRef(0);

  // to do, add some sort of (very large) cap to prevent unbounded growth
  // realistically, no user will ever encounter a breaking point, but since we can't reject on dismount, we should probably clean this up
  const requestQueueRef = useRef<Map<string, TranslationRequestQueueItem>>(
    new Map()
  );

  const pendingRequestQueueRef = useRef<
    Map<string, Promise<TranslatedChildren>>
  >(new Map());

  // Send a request to the runtime server
  const sendBatchRequest = useCallback(
    async (batchRequests: Map<string, TranslationRequestQueueItem>) => {
      if (batchRequests.size === 0) {
        return {};
      }

      // increment active requests
      activeRequestsRef.current += 1;

      const requests = Array.from(batchRequests.values());
      const newTranslations: Translations = {};
      const translationResults: Map<string, TranslatedChildren | Error> =
        new Map();

      try {
        // ----- RUNTIME TRANSLATION ----- //

        const results = await gt.translateMany(requests, {
          timeout: renderSettings.timeout,
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
            const translationValue = result.translation;
            newTranslations[hash] = translationValue;
            translationResults.set(hash, translationValue);
          }
          // translation failure
          else if ('error' in result) {
            // log error message
            const errorMsg = createGenericRuntimeTranslationError(
              request.metadata.id,
              request.metadata.hash
            );
            console.error(
              errorMsg,
              result.error || 'An upstream error occurred.'
            );

            // Create error object and store it
            const error = new Error(
              `Translation failed for ${request.metadata.id || request.metadata.hash}: ${result.error || 'Unknown error'}`
            );
            translationResults.set(hash, error);

            // Still set null in translations for state
            newTranslations[hash] = null;
          }
          // unknown error
          else {
            const errorMsg = createGenericRuntimeTranslationError(
              request.metadata.id,
              request.metadata.hash
            );
            console.error(errorMsg, result);

            // Create error for unknown response
            const error = new Error(
              `Unknown response format for ${request.metadata.id || request.metadata.hash}`
            );
            translationResults.set(hash, error);
            newTranslations[hash] = null;
          }
        });
      } catch (error) {
        // log error
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(runtimeTranslationTimeoutWarning);
        } else {
          console.error(dynamicTranslationError, error);
        }

        // Create errors for all translations from this request
        const batchError =
          error instanceof Error
            ? error
            : new Error('Batch translation request failed');

        requests.forEach((request) => {
          translationResults.set(request.metadata.hash, batchError);
          newTranslations[request.metadata.hash] = null;
        });
      } finally {
        // decrement active requests
        activeRequestsRef.current -= 1;

        // Resolve or reject all promises based on their results
        requests.forEach((request) => {
          const result = translationResults.get(request.metadata.hash);

          if (result instanceof Error) {
            request.reject(result);
          } else if (result !== undefined) {
            request.resolve(result);
          } else {
            // Fallback for unexpected cases
            request.reject(
              new Error(`No translation result for ${request.metadata.hash}`)
            );
          }
        });

        // return the new translations for state update
        return newTranslations;
      }
    },
    [gt, locale, globalMetadata, versionId, renderSettings.timeout]
  );

  // Create translation registration functions
  const { icu: registerIcuForTranslation, jsx: registerJsxForTranslation } =
    useMemo(() => {
      const createTranslationRegistrationFunction = <T extends DataFormat>(
        dataFormat: T
      ) => {
        return (params: {
          source: T extends 'ICU'
            ? Parameters<TranslateIcuCallback>[0]['source']
            : T extends 'JSX'
              ? Parameters<TranslateChildrenCallback>[0]['source']
              : never;
          targetLocale: string;
          metadata: TranslationRequestMetadata;
        }): Promise<TranslatedChildren> => {
          
          // Get the key, which is a combination of hash and locale
          const key = `${params.metadata.hash}:${params.targetLocale}`;

          // Return existing promise if request is already pending
          const pendingRequest = pendingRequestQueueRef.current.get(key);
          if (pendingRequest) {
            return pendingRequest;
          }

          // Create the promise and store resolve/reject for later
          const translationPromise = new Promise<TranslatedChildren>(
            (resolve, reject) => {
              // Set a timeout to ensure the promise doesn't hang forever
              /*const timeoutId = setTimeout(() => {
                // Check if still in queue (wasn't processed)
                if (requestQueueRef.current.has(key)) {
                  requestQueueRef.current.delete(key);
                  pendingRequestQueueRef.current.delete(key);
                  const timeoutError = new Error(
                    `Translation request timed out for key: ${key}`
                  );
                  console.warn(timeoutError.message);
                  reject(timeoutError);
                }
              }, renderSettings.timeout || maxTimeout);*/

              const requestItem =
                dataFormat === 'JSX'
                  ? {
                      dataFormat: 'JSX' as const,
                      source: params.source as JsxChildren,
                      metadata: params.metadata,
                      resolve: (value: TranslatedChildren) => {
                        resolve(value);
                      },
                      reject: (error: any) => {
                        reject(error);
                      },
                    }
                  : {
                      dataFormat: dataFormat as 'ICU',
                      source: params.source as string,
                      metadata: params.metadata,
                      resolve: (value: TranslatedChildren) => {
                        resolve(value);
                      },
                      reject: (error: any) => {
                        reject(error);
                      },
                    };

              requestQueueRef.current.set(key, requestItem);
            }
          );

          // Clean up the pending request on completion (success or failure)
          const chainedPromise = translationPromise.finally(() => {
            pendingRequestQueueRef.current.delete(key);
          });

          pendingRequestQueueRef.current.set(key, chainedPromise);
          return chainedPromise;
        };
      };
      return {
        icu: createTranslationRegistrationFunction('ICU'),
        jsx: createTranslationRegistrationFunction('JSX'),
      };
    }, [renderSettings.timeout]);

  // Process translation requests in batches
  useEffect(() => {
    let storeResults = true;

    // Process any pending requests immediately when effect runs
    const processPendingRequests = async () => {
      if (
        requestQueueRef.current.size > 0 &&
        activeRequestsRef.current < maxConcurrentRequests
      ) {
        const batchSize = Math.min(maxBatchSize, requestQueueRef.current.size);
        const batchRequests = new Map(
          Array.from(requestQueueRef.current.entries()).slice(0, batchSize)
        );

        // Remove from queue immediately to prevent double processing
        batchRequests.forEach((_, key) => requestQueueRef.current.delete(key));

        // Process the batch
        const batchResult = await sendBatchRequest(batchRequests);
        
        if (storeResults) {
          setTranslations((prev) => ({
            ...(prev || {}),
            ...batchResult,
          }));
        }
      }
    };

    // Process immediately on mount/update
    processPendingRequests();

    // Then set up interval for batching
    const intervalId = setInterval(processPendingRequests, batchInterval);

    return () => {
      storeResults = false;
      clearInterval(intervalId);
    };
  }, [sendBatchRequest, setTranslations]);

  return {
    runtimeTranslationEnabled,
    registerIcuForTranslation,
    registerJsxForTranslation,
  };
}

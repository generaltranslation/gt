import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createMismatchingHashWarning,
  createMismatchingIdHashWarning,
  dynamicTranslationError,
  createGenericRuntimeTranslationError,
} from '../../messages/createMessages';
import {
  RenderMethod,
  TranslateChildrenCallback,
  TranslateContentCallback,
  TranslationsObject,
} from '../../types/types';
import { Content } from 'generaltranslation/internal';
import {
  maxConcurrentRequests,
  maxBatchSize,
  batchInterval,
} from '../config/defaultProps';

export default function useRuntimeTranslation({
  projectId,
  devApiKey,
  locale,
  _versionId,
  defaultLocale,
  runtimeUrl,
  renderSettings,
  setTranslations,
  ...metadata
}: {
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
} {
  metadata = { ...metadata, projectId, sourceLocale: defaultLocale };

  const [activeRequests, setActiveRequests] = useState(0);

  const translationEnabled = !!(runtimeUrl && projectId);
  if (!translationEnabled)
    return {
      translationEnabled,
      translateContent: () =>
        Promise.reject(
          new Error('translateContent() failed because translation is disabled')
        ),
      translateChildren: () =>
        Promise.reject(
          new Error(
            'translateChildren() failed because translation is disabled'
          )
        ),
    };

  // Queue to store requested keys between renders.
  type TranslationRequestQueueItem = {
    type: 'content' | 'jsx';
    source: Content | any;
    metadata: { hash: string; context?: string } & Record<string, any>;
    resolve: any;
    reject: any;
  };
  // Requests waiting to be sent
  const requestQueueRef = useRef<Map<string, TranslationRequestQueueItem>>(
    new Map()
  );
  // Requests that have yet to be resolved
  const pendingRequestQueueRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    // remove all pending requests
    requestQueueRef.current.forEach((item) => item.resolve());
    requestQueueRef.current.clear();
  }, [locale]);

  const translateContent = useCallback(
    (params: {
      source: Content;
      targetLocale: string;
      metadata: { hash: string; context?: string } & Record<string, any>;
    }): Promise<void> => {
      // get the key
      const id = params.metadata.id ? `${params.metadata.id}-` : '';
      const key = `${id}${params.metadata.hash}-${params.targetLocale}`;

      // return a promise to current request if it exists
      const pendingRequest = pendingRequestQueueRef.current.get(key);
      if (pendingRequest) {
        return pendingRequest;
      }

      // promise for hooking into the translation request request to know when complete
      const translationPromise = new Promise<void>((resolve, reject) => {
        requestQueueRef.current.set(key, {
          type: 'content',
          source: params.source,
          metadata: params.metadata,
          resolve,
          reject,
        });
      })
        .catch((error) => {
          throw error;
        })
        .finally(() => {
          pendingRequestQueueRef.current.delete(key);
        });
      pendingRequestQueueRef.current.set(key, translationPromise);
      return translationPromise;
    },
    [locale]
  );

  /**
   * Call this from <T> components to request a translation key.
   * Keys are batched and fetched in the next effect cycle.
   */
  const translateChildren = useCallback(
    (params: {
      source: any;
      targetLocale: string;
      metadata: { hash: string; context?: string } & Record<string, any>;
    }): Promise<void> => {
      // get the key
      const id = params.metadata.id ? `${params.metadata.id}-` : '';
      const key = `${id}${params.metadata.hash}-${params.targetLocale}`;

      // return a promise to current request if it exists
      const pendingRequest = pendingRequestQueueRef.current.get(key);
      if (pendingRequest) {
        return pendingRequest;
      }

      // promise for hooking into the translation request to know when complete
      const translationPromise = new Promise<void>((resolve, reject) => {
        requestQueueRef.current.set(key, {
          type: 'jsx',
          source: params.source,
          metadata: params.metadata,
          resolve,
          reject,
        });
      })
        .catch((error) => {
          throw error;
        })
        .finally(() => {
          pendingRequestQueueRef.current.delete(key);
        });
      pendingRequestQueueRef.current.set(key, translationPromise);
      return translationPromise;
    },
    [locale]
  );
  // Send a request to the runtime server
  const sendBatchRequest = async (
    batchRequests: Map<string, TranslationRequestQueueItem>,
    targetLocale: string
  ) => {
    if (requestQueueRef.current.size === 0) {
      return {};
    }

    // increment active requests
    setActiveRequests((prev) => prev + 1);

    const requests = Array.from(batchRequests.values());
    const newTranslations: TranslationsObject = {};

    try {
      // ----- TRANSLATION LOADING ----- //
      const loadingTranslations: TranslationsObject = requests.reduce(
        (acc: TranslationsObject, request) => {
          // loading state for jsx, render loading behavior
          const key = request.metadata.id || request.metadata.hash;
          acc[key] = { state: 'loading' };
          return acc;
        },
        {}
      );
      setTranslations((prev: any) => {
        return { ...(prev || {}), ...loadingTranslations };
      });

      // ----- RUNTIME TRANSLATION ----- //
      const fetchWithAbort = async (
        url: string,
        options: RequestInit | undefined,
        timeout: number | undefined
      ) => {
        const controller = new AbortController();
        const timeoutId =
          timeout === undefined
            ? undefined
            : setTimeout(() => controller.abort(), timeout);
        try {
          return await fetch(url, { ...options, signal: controller.signal });
        } catch (error) {
          console.error('timeout!');
          if (error instanceof Error && error.name === 'AbortError')
            throw new Error('Request timed out'); // Handle the timeout case
          throw error; // Re-throw other errors
        } finally {
          if (timeoutId !== undefined) clearTimeout(timeoutId); // Ensure timeout is cleared
        }
      };
      const response = await fetchWithAbort(
        `${runtimeUrl}/v1/runtime/${projectId}/client`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(devApiKey && { 'x-gt-dev-api-key': devApiKey }),
          },
          body: JSON.stringify({
            requests,
            targetLocale,
            metadata,
            version: _versionId,
          }),
        },
        renderSettings.timeout
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // ----- PARSE RESPONSE ----- //
      const results = (await response.json()) as any[];
      // don't send another req if one is already in flight

      // process each result
      results.forEach((result, index) => {
        const request = requests[index];

        // translation received
        if ('translation' in result && result.translation && result.reference) {
          const {
            translation,
            reference: { id, key: hash },
          } = result;
          // check for mismatching ids or hashes
          if (id !== request.metadata.id || hash !== request.metadata.hash) {
            if (!request.metadata.id) {
              console.warn(
                createMismatchingHashWarning(request.metadata.hash, hash)
              );
            } else {
              console.warn(
                createMismatchingIdHashWarning(
                  request.metadata.id,
                  request.metadata.hash,
                  id,
                  hash
                )
              );
            }
          }
          // set translation
          newTranslations[request.metadata.id || request.metadata.hash] = {
            state: 'success',
            target: translation,
          };
          return;
        }

        // translation failure
        if (
          result.error !== undefined &&
          result.error !== null &&
          result.code !== undefined &&
          result.code !== null
        ) {
          // 0 and '' are falsey
          // log error message
          console.error(
            createGenericRuntimeTranslationError(
              request.metadata.id,
              request.metadata.hash
            ),
            result.error
          );
          // set error in translation object
          newTranslations[request.metadata.id || request.metadata.hash] = {
            state: 'error',
            error: result.error,
            code: result.code,
          };
          return;
        }

        // unknown error
        console.error(
          createGenericRuntimeTranslationError(
            request.metadata.id,
            request.metadata.hash
          ),
          result
        );
        newTranslations[request.metadata.id || request.metadata.hash] = {
          state: 'error',
          error: 'An error occurred.',
          code: 500,
        };
      });
    } catch (error) {
      // log error
      console.error(dynamicTranslationError, error);

      // add error message to all translations from this request
      requests.forEach((request) => {
        // id defaults to hash if none provided
        newTranslations[request.metadata.id || request.metadata.hash] = {
          state: 'error',
          error: 'An error occurred.',
          code: 500,
        };
      });
    } finally {
      // decrement active requests
      setActiveRequests((prev) => prev - 1);

      // resolve all promises
      requests.forEach((request) => request.resolve());

      // return the new translations
      return newTranslations;
    }
  };

  useEffect(() => {
    // flag for storing fetch from api
    let storeResults = true;

    // Send a batch request every `batchInterval` ms
    const intervalId = setInterval(() => {
      if (
        requestQueueRef.current.size > 0 &&
        activeRequests < maxConcurrentRequests
      ) {
        const batchSize = Math.min(maxBatchSize, requestQueueRef.current.size);
        const batchRequests = new Map(
          Array.from(requestQueueRef.current.entries()).slice(0, batchSize)
        );
        (async () => {
          const batchResult = await sendBatchRequest(batchRequests, locale);
          if (storeResults) {
            setTranslations((prev: any) => {
              return { ...(prev || {}), ...batchResult };
            });
          }
        })();
        batchRequests.forEach((_, key) => requestQueueRef.current.delete(key));
      }
    }, batchInterval);

    // Cleanup on unmount
    return () => {
      storeResults = false; // Don't store locale changes
      clearInterval(intervalId); // Clear the interval
    };
  }, [locale]);

  return { translateContent, translateChildren, translationEnabled };
}

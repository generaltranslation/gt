var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { useCallback, useEffect, useRef, useState } from 'react';
import { createMismatchingHashWarning, dynamicTranslationError, createGenericRuntimeTranslationError, } from '../../messages/createMessages';
import { maxConcurrentRequests, maxBatchSize, batchInterval, } from '../config/defaultProps';
export default function useRuntimeTranslation(_a) {
    var { projectId, devApiKey, locale, versionId, defaultLocale, runtimeUrl, renderSettings, setTranslations, runtimeTranslationEnabled } = _a, metadata = __rest(_a, ["projectId", "devApiKey", "locale", "versionId", "defaultLocale", "runtimeUrl", "renderSettings", "setTranslations", "runtimeTranslationEnabled"]);
    metadata = Object.assign(Object.assign({}, metadata), { projectId, sourceLocale: defaultLocale });
    const [activeRequests, setActiveRequests] = useState(0);
    if (!runtimeTranslationEnabled)
        return {
            translateContent: () => Promise.reject(new Error('translateContent() failed because translation is disabled')),
            translateChildren: () => Promise.reject(new Error('translateChildren() failed because translation is disabled')),
        };
    // Requests waiting to be sent
    const requestQueueRef = useRef(new Map());
    // Requests that have yet to be resolved
    const pendingRequestQueueRef = useRef(new Map());
    useEffect(() => {
        // remove all pending requests
        requestQueueRef.current.forEach((item) => item.resolve());
        requestQueueRef.current.clear();
    }, [locale]);
    const translateContent = useCallback((params) => {
        // get the key
        const id = params.metadata.id ? `${params.metadata.id}-` : '';
        const key = `${id}${params.metadata.hash}-${params.targetLocale}`;
        // return a promise to current request if it exists
        const pendingRequest = pendingRequestQueueRef.current.get(key);
        if (pendingRequest) {
            return pendingRequest;
        }
        // promise for hooking into the translation request request to know when complete
        const translationPromise = new Promise((resolve, reject) => {
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
    }, [locale]);
    /**
     * Call this from <T> components to request a translation key.
     * Keys are batched and fetched in the next effect cycle.
     */
    const translateChildren = useCallback((params) => {
        // get the key
        const id = params.metadata.id ? `${params.metadata.id}-` : '';
        const key = `${id}${params.metadata.hash}-${params.targetLocale}`;
        // return a promise to current request if it exists
        const pendingRequest = pendingRequestQueueRef.current.get(key);
        if (pendingRequest) {
            return pendingRequest;
        }
        // promise for hooking into the translation request to know when complete
        const translationPromise = new Promise((resolve, reject) => {
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
    }, [locale]);
    // Send a request to the runtime server
    const sendBatchRequest = (batchRequests, targetLocale) => __awaiter(this, void 0, void 0, function* () {
        if (requestQueueRef.current.size === 0) {
            return {};
        }
        // increment active requests
        setActiveRequests((prev) => prev + 1);
        const requests = Array.from(batchRequests.values());
        const newTranslations = {};
        try {
            // ----- TRANSLATION LOADING ----- //
            const loadingTranslations = requests.reduce((acc, request) => {
                // loading state for jsx, render loading behavior
                const key = process.env.NODE_ENV === 'development'
                    ? request.metadata.hash
                    : request.metadata.id || request.metadata.hash;
                acc[key] = { state: 'loading' };
                return acc;
            }, {});
            setTranslations((prev) => {
                return Object.assign(Object.assign({}, (prev || {})), loadingTranslations);
            });
            // ----- RUNTIME TRANSLATION ----- //
            const fetchWithAbort = (url, options, timeout) => __awaiter(this, void 0, void 0, function* () {
                const controller = new AbortController();
                const timeoutId = timeout === undefined
                    ? undefined
                    : setTimeout(() => controller.abort(), timeout);
                try {
                    return yield fetch(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
                }
                catch (error) {
                    console.error('timeout!');
                    if (error instanceof Error && error.name === 'AbortError')
                        throw new Error('Request timed out'); // Handle the timeout case
                    throw error; // Re-throw other errors
                }
                finally {
                    if (timeoutId !== undefined)
                        clearTimeout(timeoutId); // Ensure timeout is cleared
                }
            });
            const response = yield fetchWithAbort(`${runtimeUrl}/v1/runtime/${projectId}/client`, {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, (devApiKey && { 'x-gt-dev-api-key': devApiKey })),
                body: JSON.stringify({
                    requests,
                    targetLocale,
                    metadata,
                    versionId,
                }),
            }, renderSettings.timeout);
            if (!response.ok) {
                throw new Error(yield response.text());
            }
            // ----- PARSE RESPONSE ----- //
            const results = (yield response.json());
            // don't send another req if one is already in flight
            // process each result
            results.forEach((result, index) => {
                var _a;
                const request = requests[index];
                const key = process.env.NODE_ENV === 'development'
                    ? request.metadata.hash
                    : request.metadata.id || request.metadata.hash;
                // translation received
                if ('translation' in result && result.translation && result.reference) {
                    const { translation, reference: { id, key: hash }, } = result;
                    // check for mismatching ids or hashes
                    if (hash !== request.metadata.hash) {
                        console.warn(createMismatchingHashWarning(request.metadata.hash, hash));
                    }
                    // set translation
                    newTranslations[key] = Object.assign({ state: 'success', target: translation }, (((_a = request === null || request === void 0 ? void 0 : request.metadata) === null || _a === void 0 ? void 0 : _a.hash) && { hash: request.metadata.hash }));
                    return;
                }
                // translation failure
                if (result.error !== undefined &&
                    result.error !== null &&
                    result.code !== undefined &&
                    result.code !== null) {
                    // 0 and '' are falsey
                    // log error message
                    console.error(createGenericRuntimeTranslationError(request.metadata.id, request.metadata.hash), result.error);
                    // set error in translation object
                    newTranslations[key] = {
                        state: 'error',
                        error: result.error,
                        code: result.code,
                    };
                    return;
                }
                // unknown error
                console.error(createGenericRuntimeTranslationError(request.metadata.id, request.metadata.hash), result);
                newTranslations[key] = {
                    state: 'error',
                    error: 'An error occurred.',
                    code: 500,
                };
            });
        }
        catch (error) {
            // log error
            console.error(dynamicTranslationError, error);
            // add error message to all translations from this request
            requests.forEach((request) => {
                const key = process.env.NODE_ENV === 'development'
                    ? request.metadata.hash
                    : request.metadata.id || request.metadata.hash;
                // id defaults to hash if none provided
                newTranslations[key] = {
                    state: 'error',
                    error: 'An error occurred.',
                    code: 500,
                };
            });
        }
        finally {
            // decrement active requests
            setActiveRequests((prev) => prev - 1);
            // resolve all promises
            requests.forEach((request) => request.resolve());
            // return the new translations
            return newTranslations;
        }
    });
    useEffect(() => {
        // flag for storing fetch from api
        let storeResults = true;
        // Send a batch request every `batchInterval` ms
        const intervalId = setInterval(() => {
            if (requestQueueRef.current.size > 0 &&
                activeRequests < maxConcurrentRequests) {
                const batchSize = Math.min(maxBatchSize, requestQueueRef.current.size);
                const batchRequests = new Map(Array.from(requestQueueRef.current.entries()).slice(0, batchSize));
                (() => __awaiter(this, void 0, void 0, function* () {
                    const batchResult = yield sendBatchRequest(batchRequests, locale);
                    if (storeResults) {
                        setTranslations((prev) => {
                            return Object.assign(Object.assign({}, (prev || {})), batchResult);
                        });
                    }
                }))();
                batchRequests.forEach((_, key) => requestQueueRef.current.delete(key));
            }
        }, batchInterval);
        // Cleanup on unmount
        return () => {
            storeResults = false; // Don't store locale changes
            clearInterval(intervalId); // Clear the interval
        };
    }, [locale]);
    return { translateContent, translateChildren };
}

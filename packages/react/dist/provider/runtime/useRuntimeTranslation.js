"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useRuntimeTranslation;
const react_1 = require("react");
const createMessages_1 = require("../../messages/createMessages");
const defaultProps_1 = require("../config/defaultProps");
function useRuntimeTranslation(_a) {
    var { targetLocale, projectId, devApiKey, runtimeUrl, defaultLocale, renderSettings, setTranslations } = _a, metadata = __rest(_a, ["targetLocale", "projectId", "devApiKey", "runtimeUrl", "defaultLocale", "renderSettings", "setTranslations"]);
    metadata = Object.assign(Object.assign({}, metadata), { projectId, sourceLocale: defaultLocale });
    const [inflightCount, setInflightCount] = (0, react_1.useState)(0);
    const [conccurentRequestCount, setConcurrentRequestCount] = (0, react_1.useState)(0);
    const [requestMap, setRequestMap] = (0, react_1.useState)(new Map());
    const [activeRequests, setActiveRequests] = (0, react_1.useState)(0);
    const translationEnabled = !!(runtimeUrl && projectId);
    if (!translationEnabled)
        return {
            translationEnabled,
            translateContent: () => Promise.reject(new Error("translateContent() failed because translation is disabled")),
            translateChildren: () => Promise.reject(new Error("translateChildren() failed because translation is disabled")),
        };
    // Requests waiting to be sent (not yet batched)
    const requestQueueRef = (0, react_1.useRef)(new Map());
    // Requests that have yet to be resolved
    const pendingRequestQueueRef = (0, react_1.useRef)(new Map());
    const translateContent = (0, react_1.useCallback)((params) => {
        // get the key
        const id = params.metadata.id ? `${params.metadata.id}-` : "";
        const key = `${id}-${params.metadata.hash}-${params.targetLocale}`;
        // return a promise to current request if it exists
        const inflightRequest = pendingRequestQueueRef.current.get(key);
        if (inflightRequest) {
            return inflightRequest;
        }
        // promise for hooking into the translation request request to know when complete
        const translationPromise = new Promise((resolve, reject) => {
            requestQueueRef.current.set(key, {
                type: "content",
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
        return translationPromise;
    }, []);
    /**
     * Call this from <T> components to request a translation key.
     * Keys are batched and fetched in the next effect cycle.
     */
    const translateChildren = (0, react_1.useCallback)((params) => {
        // get the key
        const id = params.metadata.id ? `${params.metadata.id}-` : "";
        const key = `${id}-${params.metadata.hash}-${params.targetLocale}`;
        // return a promise to current request if it exists
        const inflightRequest = pendingRequestQueueRef.current.get(key);
        if (inflightRequest) {
            return inflightRequest;
        }
        // promise for hooking into the translation request to know when complete
        const translationPromise = new Promise((resolve, reject) => {
            requestQueueRef.current.set(key, {
                type: "jsx",
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
        return translationPromise;
    }, []);
    const [count, setCount] = (0, react_1.useState)(0);
    // Send a request to the runtime server
    const sendBatchRequest = (batchRequests) => __awaiter(this, void 0, void 0, function* () {
        if (requestQueueRef.current.size === 0) {
            return;
        }
        // increment active requests
        setActiveRequests((prev) => prev + 1);
        const requests = Array.from(batchRequests.values());
        const newTranslations = {};
        try {
            // ----- TRANSLATION LOADING ----- //
            const loadingTranslations = requests.reduce((acc, request) => {
                // loading state for jsx, render loading behavior
                const id = request.metadata.id || request.metadata.hash;
                acc[id] = { [request.metadata.hash]: { state: "loading" } };
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
                    console.error("timeout!");
                    if (error instanceof Error && error.name === "AbortError")
                        throw new Error("Request timed out"); // Handle the timeout case
                    throw error; // Re-throw other errors
                }
                finally {
                    if (timeoutId !== undefined)
                        clearTimeout(timeoutId); // Ensure timeout is cleared
                }
            });
            const response = yield fetchWithAbort(`${runtimeUrl}/v1/runtime/${projectId}/client`, {
                method: "POST",
                headers: Object.assign({ "Content-Type": "application/json" }, (devApiKey && { "x-gt-dev-api-key": devApiKey })),
                body: JSON.stringify({
                    requests,
                    targetLocale,
                    metadata,
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
                const request = requests[index];
                // translation received
                if ("translation" in result && result.translation && result.reference) {
                    const { translation, reference: { id, key: hash }, } = result;
                    // check for mismatching ids or hashes
                    if (id !== request.metadata.id || hash !== request.metadata.hash) {
                        if (!request.metadata.id) {
                            console.warn((0, createMessages_1.createMismatchingHashWarning)(request.metadata.hash, hash));
                        }
                        else {
                            console.warn((0, createMessages_1.createMismatchingIdHashWarning)(request.metadata.id, request.metadata.hash, id, hash));
                        }
                    }
                    // set translation
                    newTranslations[request.metadata.id || request.metadata.hash] = {
                        // id defaults to hash if none provided
                        [request.metadata.hash]: {
                            state: "success",
                            target: translation,
                        },
                    };
                    return;
                }
                // translation failure
                if (result.error !== undefined &&
                    result.error !== null &&
                    result.code !== undefined &&
                    result.code !== null) {
                    // 0 and '' are falsey
                    // log error message
                    console.error((0, createMessages_1.createGenericRuntimeTranslationError)(request.metadata.id, request.metadata.hash), result.error);
                    // set error in translation object
                    newTranslations[request.metadata.id || request.metadata.hash] = {
                        [request.metadata.hash]: {
                            state: "error",
                            error: result.error,
                            code: result.code,
                        },
                    };
                    return;
                }
                // unknown error
                console.error((0, createMessages_1.createGenericRuntimeTranslationError)(request.metadata.id, request.metadata.hash), result);
                newTranslations[request.metadata.id || request.metadata.hash] = {
                    [request.metadata.hash]: {
                        state: "error",
                        error: "An error occurred.",
                        code: 500,
                    },
                };
            });
        }
        catch (error) {
            // log error
            console.error(createMessages_1.dynamicTranslationError, error);
            // add error message to all translations from this request
            requests.forEach((request) => {
                // id defaults to hash if none provided
                newTranslations[request.metadata.id || request.metadata.hash] = {
                    [request.metadata.hash]: {
                        state: "error",
                        error: "An error occurred.",
                        code: 500,
                    },
                };
            });
        }
        finally {
            // update our translations
            setTranslations((prev) => {
                return Object.assign(Object.assign({}, (prev || {})), newTranslations);
            });
            // decrement active requests
            setActiveRequests((prev) => prev - 1);
            // resolve all promises
            requests.forEach((request) => request.resolve());
        }
    });
    // Try to send a batch request every `batchInterval` ms
    const startBatching = () => {
        setInterval(() => {
            if (requestQueueRef.current.size > 0 &&
                activeRequests < defaultProps_1.maxConcurrentRequests) {
                const batchSize = Math.min(defaultProps_1.maxBatchSize, requestQueueRef.current.size);
                const batchRequests = new Map(Array.from(requestQueueRef.current.entries()).slice(0, batchSize));
                sendBatchRequest(batchRequests);
                batchRequests.forEach((_, key) => requestQueueRef.current.delete(key));
            }
        }, defaultProps_1.batchInterval);
    };
    startBatching();
    return { translateContent, translateChildren, translationEnabled };
}
//# sourceMappingURL=useRuntimeTranslation.js.map
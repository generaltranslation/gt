"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
var react_1 = require("react");
var createMessages_1 = require("../../messages/createMessages");
var defaultProps_1 = require("../config/defaultProps");
function useRuntimeTranslation(_a) {
    var _this = this;
    var targetLocale = _a.targetLocale, projectId = _a.projectId, devApiKey = _a.devApiKey, runtimeUrl = _a.runtimeUrl, defaultLocale = _a.defaultLocale, renderSettings = _a.renderSettings, setTranslations = _a.setTranslations, metadata = __rest(_a, ["targetLocale", "projectId", "devApiKey", "runtimeUrl", "defaultLocale", "renderSettings", "setTranslations"]);
    metadata = __assign(__assign({}, metadata), { projectId: projectId, sourceLocale: defaultLocale });
    var _b = (0, react_1.useState)(0), inflightCount = _b[0], setInflightCount = _b[1];
    var _c = (0, react_1.useState)(0), conccurentRequestCount = _c[0], setConcurrentRequestCount = _c[1];
    var _d = (0, react_1.useState)(new Map()), requestMap = _d[0], setRequestMap = _d[1];
    var _e = (0, react_1.useState)(0), activeRequests = _e[0], setActiveRequests = _e[1];
    var translationEnabled = !!(runtimeUrl && projectId);
    if (!translationEnabled)
        return {
            translationEnabled: translationEnabled,
            translateContent: function () {
                return Promise.reject(new Error("translateContent() failed because translation is disabled"));
            },
            translateChildren: function () {
                return Promise.reject(new Error("translateChildren() failed because translation is disabled"));
            },
        };
    // Requests waiting to be sent (not yet batched)
    var requestQueueRef = (0, react_1.useRef)(new Map());
    // Requests that have yet to be resolved
    var pendingRequestQueueRef = (0, react_1.useRef)(new Map());
    var translateContent = (0, react_1.useCallback)(function (params) {
        // get the key
        var id = params.metadata.id ? "".concat(params.metadata.id, "-") : "";
        var key = "".concat(id, "-").concat(params.metadata.hash, "-").concat(params.targetLocale);
        // return a promise to current request if it exists
        var inflightRequest = pendingRequestQueueRef.current.get(key);
        if (inflightRequest) {
            return inflightRequest;
        }
        // promise for hooking into the translation request request to know when complete
        var translationPromise = new Promise(function (resolve, reject) {
            requestQueueRef.current.set(key, {
                type: "content",
                source: params.source,
                metadata: params.metadata,
                resolve: resolve,
                reject: reject,
            });
        })
            .catch(function (error) {
            throw error;
        })
            .finally(function () {
            pendingRequestQueueRef.current.delete(key);
        });
        return translationPromise;
    }, []);
    /**
     * Call this from <T> components to request a translation key.
     * Keys are batched and fetched in the next effect cycle.
     */
    var translateChildren = (0, react_1.useCallback)(function (params) {
        // get the key
        var id = params.metadata.id ? "".concat(params.metadata.id, "-") : "";
        var key = "".concat(id, "-").concat(params.metadata.hash, "-").concat(params.targetLocale);
        // return a promise to current request if it exists
        var inflightRequest = pendingRequestQueueRef.current.get(key);
        if (inflightRequest) {
            return inflightRequest;
        }
        // promise for hooking into the translation request to know when complete
        var translationPromise = new Promise(function (resolve, reject) {
            requestQueueRef.current.set(key, {
                type: "jsx",
                source: params.source,
                metadata: params.metadata,
                resolve: resolve,
                reject: reject,
            });
        })
            .catch(function (error) {
            throw error;
        })
            .finally(function () {
            pendingRequestQueueRef.current.delete(key);
        });
        return translationPromise;
    }, []);
    var _f = (0, react_1.useState)(0), count = _f[0], setCount = _f[1];
    // Send a request to the runtime server
    var sendBatchRequest = function (batchRequests) { return __awaiter(_this, void 0, void 0, function () {
        var requests, newTranslations, loadingTranslations_1, fetchWithAbort, response, _a, results, error_1;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (requestQueueRef.current.size === 0) {
                        return [2 /*return*/];
                    }
                    // increment active requests
                    setActiveRequests(function (prev) { return prev + 1; });
                    requests = Array.from(batchRequests.values());
                    newTranslations = {};
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    loadingTranslations_1 = requests.reduce(function (acc, request) {
                        var _a;
                        // loading state for jsx, render loading behavior
                        var id = request.metadata.id || request.metadata.hash;
                        acc[id] = (_a = {}, _a[request.metadata.hash] = { state: "loading" }, _a);
                        return acc;
                    }, {});
                    setTranslations(function (prev) {
                        return __assign(__assign({}, (prev || {})), loadingTranslations_1);
                    });
                    fetchWithAbort = function (url, options, timeout) { return __awaiter(_this, void 0, void 0, function () {
                        var controller, timeoutId, error_2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    controller = new AbortController();
                                    timeoutId = timeout === undefined
                                        ? undefined
                                        : setTimeout(function () { return controller.abort(); }, timeout);
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, 4, 5]);
                                    return [4 /*yield*/, fetch(url, __assign(__assign({}, options), { signal: controller.signal }))];
                                case 2: return [2 /*return*/, _a.sent()];
                                case 3:
                                    error_2 = _a.sent();
                                    console.error("timeout!");
                                    if (error_2 instanceof Error && error_2.name === "AbortError")
                                        throw new Error("Request timed out"); // Handle the timeout case
                                    throw error_2; // Re-throw other errors
                                case 4:
                                    if (timeoutId !== undefined)
                                        clearTimeout(timeoutId); // Ensure timeout is cleared
                                    return [7 /*endfinally*/];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, fetchWithAbort("".concat(runtimeUrl, "/v1/runtime/").concat(projectId, "/client"), {
                            method: "POST",
                            headers: __assign({ "Content-Type": "application/json" }, (devApiKey && { "x-gt-dev-api-key": devApiKey })),
                            body: JSON.stringify({
                                requests: requests,
                                targetLocale: targetLocale,
                                metadata: metadata,
                            }),
                        }, renderSettings.timeout)];
                case 2:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    _a = Error.bind;
                    return [4 /*yield*/, response.text()];
                case 3: throw new (_a.apply(Error, [void 0, _b.sent()]))();
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    results = (_b.sent());
                    // don't send another req if one is already in flight
                    // process each result
                    results.forEach(function (result, index) {
                        var _a, _b, _c;
                        var request = requests[index];
                        // translation received
                        if ("translation" in result && result.translation && result.reference) {
                            var translation = result.translation, _d = result.reference, id = _d.id, hash = _d.key;
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
                            newTranslations[request.metadata.id || request.metadata.hash] = (_a = {},
                                // id defaults to hash if none provided
                                _a[request.metadata.hash] = {
                                    state: "success",
                                    target: translation,
                                },
                                _a);
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
                            newTranslations[request.metadata.id || request.metadata.hash] = (_b = {},
                                _b[request.metadata.hash] = {
                                    state: "error",
                                    error: result.error,
                                    code: result.code,
                                },
                                _b);
                            return;
                        }
                        // unknown error
                        console.error((0, createMessages_1.createGenericRuntimeTranslationError)(request.metadata.id, request.metadata.hash), result);
                        newTranslations[request.metadata.id || request.metadata.hash] = (_c = {},
                            _c[request.metadata.hash] = {
                                state: "error",
                                error: "An error occurred.",
                                code: 500,
                            },
                            _c);
                    });
                    return [3 /*break*/, 8];
                case 6:
                    error_1 = _b.sent();
                    // log error
                    console.error(createMessages_1.dynamicTranslationError, error_1);
                    // add error message to all translations from this request
                    requests.forEach(function (request) {
                        var _a;
                        // id defaults to hash if none provided
                        newTranslations[request.metadata.id || request.metadata.hash] = (_a = {},
                            _a[request.metadata.hash] = {
                                state: "error",
                                error: "An error occurred.",
                                code: 500,
                            },
                            _a);
                    });
                    return [3 /*break*/, 8];
                case 7:
                    // update our translations
                    setTranslations(function (prev) {
                        return __assign(__assign({}, (prev || {})), newTranslations);
                    });
                    // decrement active requests
                    setActiveRequests(function (prev) { return prev - 1; });
                    // resolve all promises
                    requests.forEach(function (request) { return request.resolve(); });
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    // Try to send a batch request every `batchInterval` ms
    var startBatching = function () {
        setInterval(function () {
            if (requestQueueRef.current.size > 0 &&
                activeRequests < defaultProps_1.maxConcurrentRequests) {
                var batchSize = Math.min(defaultProps_1.maxBatchSize, requestQueueRef.current.size);
                var batchRequests = new Map(Array.from(requestQueueRef.current.entries()).slice(0, batchSize));
                sendBatchRequest(batchRequests);
                batchRequests.forEach(function (_, key) { return requestQueueRef.current.delete(key); });
            }
        }, defaultProps_1.batchInterval);
    };
    startBatching();
    return { translateContent: translateContent, translateChildren: translateChildren, translationEnabled: translationEnabled };
}
//# sourceMappingURL=useRuntimeTranslation.js.map
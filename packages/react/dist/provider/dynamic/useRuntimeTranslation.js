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
var createErrors_1 = require("../../errors/createErrors");
function useRuntimeTranslation(_a) {
    var _this = this;
    var targetLocale = _a.targetLocale, projectId = _a.projectId, devApiKey = _a.devApiKey, runtimeUrl = _a.runtimeUrl, defaultLocale = _a.defaultLocale, setTranslations = _a.setTranslations, metadata = __rest(_a, ["targetLocale", "projectId", "devApiKey", "runtimeUrl", "defaultLocale", "setTranslations"]);
    metadata = __assign(__assign({}, metadata), { projectId: projectId, sourceLocale: defaultLocale });
    var translationEnabled = !!(runtimeUrl && projectId);
    if (!translationEnabled)
        return { translationEnabled: translationEnabled, translateContent: function () { }, translateChildren: function () { } };
    // Queue to store requested keys between renders.
    var requestQueueRef = (0, react_1.useRef)(new Map());
    // Trigger a fetch when keys have been added.
    var _b = (0, react_1.useState)(0), fetchTrigger = _b[0], setFetchTrigger = _b[1];
    var translateContent = (0, react_1.useCallback)(function (params) {
        var id = params.metadata.id ? "".concat(params.metadata.id, "-") : '';
        var key = "".concat(id).concat(params.metadata.hash, "-").concat(params.targetLocale);
        requestQueueRef.current.set(key, { type: 'content', source: params.source, metadata: params.metadata });
        setFetchTrigger(function (n) { return n + 1; });
    }, []);
    /**
     * Call this from <T> components to request a translation key.
     * Keys are batched and fetched in the next effect cycle.
     */
    var translateChildren = (0, react_1.useCallback)(function (params) {
        var id = params.metadata.id ? "".concat(params.metadata.id, "-") : '';
        var key = "".concat(id).concat(params.metadata.hash, "-").concat(params.targetLocale);
        requestQueueRef.current.set(key, { type: 'jsx', source: params.source, metadata: params.metadata });
        setFetchTrigger(function (n) { return n + 1; });
    }, []);
    (0, react_1.useEffect)(function () {
        if (requestQueueRef.current.size === 0) {
            return;
        }
        var isCancelled = false;
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var requests, response, _a, results, newTranslations_1, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        requests = Array.from(requestQueueRef.current.values());
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, 7, 8]);
                        return [4 /*yield*/, fetch("".concat(runtimeUrl, "/v1/runtime/").concat(projectId, "/client"), {
                                method: 'POST',
                                headers: __assign({ 'Content-Type': 'application/json' }, (devApiKey && { 'x-gt-dev-api-key': devApiKey })),
                                body: JSON.stringify({
                                    requests: requests,
                                    targetLocale: targetLocale,
                                    metadata: metadata
                                }),
                            })];
                    case 2:
                        response = _b.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        _a = Error.bind;
                        return [4 /*yield*/, response.text()];
                    case 3: throw new (_a.apply(Error, [void 0, _b.sent()]))();
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        results = _b.sent();
                        if (!isCancelled) {
                            newTranslations_1 = {};
                            results.forEach(function (result, index) {
                                var _a;
                                var request = requests[index];
                                if ('translation' in result && result.translation && result.reference) { // translation success
                                    var translation = result.translation, _b = result.reference, id = _b.id, key = _b.key;
                                    // check for mismatching ids or hashes
                                    if (id !== request.metadata.id || key !== request.metadata.hash) {
                                        if (!request.metadata.id) {
                                            console.warn("Mismatching hashes! Expected hash: ".concat(request.metadata.hash, ", but got hash: ").concat(key, ". We will still render your translation, but make sure to update to the newest version: www.generaltranslation.com/docs"));
                                        }
                                        else {
                                            console.warn("Mismatching ids or hashes! Expected id: ".concat(request.metadata.id, ", hash: ").concat(request.metadata.hash, ", but got id: ").concat(id, ", hash: ").concat(key, ". We will still render your translation, but make sure to update to the newest version: www.generaltranslation.com/docs"));
                                        }
                                    }
                                    newTranslations_1[id || request.metadata.hash] = (_a = {}, _a[request.metadata.hash] = translation, _a);
                                }
                                else if ('error' in result && result.error && result.code) { // translation error
                                    newTranslations_1[request.metadata.id || request.metadata.hash] = {
                                        error: result.error || "An error occurred.",
                                        code: result.code || 500
                                    };
                                    // error message
                                    if (!request.metadata.id) {
                                        console.error("Translation failed for hash: ".concat(request.metadata.hash, " "), result);
                                    }
                                    else {
                                        console.error("Translation failed for id: ".concat(request.metadata.id, ", hash: ").concat(request.metadata.hash, " "), result);
                                    }
                                }
                                else { // unknown error
                                    // id defaults to hash if none provided
                                    newTranslations_1[request.metadata.id || request.metadata.hash] = {
                                        error: "An error occurred.",
                                        code: 500
                                    };
                                }
                            });
                            // update our translations
                            setTranslations(function (prev) { return __assign(__assign({}, (prev || {})), newTranslations_1); });
                        }
                        return [3 /*break*/, 8];
                    case 6:
                        error_1 = _b.sent();
                        console.error(createErrors_1.dynamicTranslationError, error_1);
                        setTranslations(function (prev) {
                            var merged = __assign({}, (prev || {}));
                            requests.forEach(function (request) {
                                // id defaults to hash if none provided
                                merged[request.metadata.id || request.metadata.hash] = {
                                    error: "An error occurred.",
                                    code: 500
                                };
                            });
                            return merged;
                        });
                        return [3 /*break*/, 8];
                    case 7:
                        requestQueueRef.current.clear();
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        }); })();
        return function () {
            isCancelled = true;
        };
    }, [fetchTrigger, setTranslations]);
    return { translateContent: translateContent, translateChildren: translateChildren, translationEnabled: translationEnabled };
}
//# sourceMappingURL=useRuntimeTranslation.js.map
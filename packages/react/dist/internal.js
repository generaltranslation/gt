"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRenderSettings = exports.renderSkeleton = exports.renderTranslatedChildren = exports.renderDefaultChildren = exports.renderVariable = exports.getFallbackVariableName = exports.getVariableName = exports.extractEntryMetadata = exports.getPluralBranch = exports.getVariableProps = exports.getDictionaryEntry = exports.flattenDictionary = exports.isEmptyReactFragment = exports.isVariableObject = exports.writeChildrenAsObjects = exports.addGTIdentifier = void 0;
var flattenDictionary_1 = __importDefault(require("./internal/flattenDictionary"));
exports.flattenDictionary = flattenDictionary_1.default;
var addGTIdentifier_1 = __importDefault(require("./internal/addGTIdentifier"));
exports.addGTIdentifier = addGTIdentifier_1.default;
var writeChildrenAsObjects_1 = __importDefault(require("./internal/writeChildrenAsObjects"));
exports.writeChildrenAsObjects = writeChildrenAsObjects_1.default;
var getPluralBranch_1 = __importDefault(require("./branches/plurals/getPluralBranch"));
exports.getPluralBranch = getPluralBranch_1.default;
var getDictionaryEntry_1 = __importDefault(require("./provider/helpers/getDictionaryEntry"));
exports.getDictionaryEntry = getDictionaryEntry_1.default;
var extractEntryMetadata_1 = __importDefault(require("./provider/helpers/extractEntryMetadata"));
exports.extractEntryMetadata = extractEntryMetadata_1.default;
var _getVariableProps_1 = __importDefault(require("./variables/_getVariableProps"));
exports.getVariableProps = _getVariableProps_1.default;
var isVariableObject_1 = __importDefault(require("./provider/helpers/isVariableObject"));
exports.isVariableObject = isVariableObject_1.default;
var getVariableName_1 = __importStar(require("./variables/getVariableName"));
exports.getVariableName = getVariableName_1.default;
Object.defineProperty(exports, "getFallbackVariableName", { enumerable: true, get: function () { return getVariableName_1.getFallbackVariableName; } });
var renderDefaultChildren_1 = __importDefault(require("./provider/rendering/renderDefaultChildren"));
exports.renderDefaultChildren = renderDefaultChildren_1.default;
var renderTranslatedChildren_1 = __importDefault(require("./provider/rendering/renderTranslatedChildren"));
exports.renderTranslatedChildren = renderTranslatedChildren_1.default;
var defaultRenderSettings_1 = require("./provider/rendering/defaultRenderSettings");
Object.defineProperty(exports, "defaultRenderSettings", { enumerable: true, get: function () { return defaultRenderSettings_1.defaultRenderSettings; } });
var renderSkeleton_1 = __importDefault(require("./provider/rendering/renderSkeleton"));
exports.renderSkeleton = renderSkeleton_1.default;
var renderVariable_1 = __importDefault(require("./provider/rendering/renderVariable"));
exports.renderVariable = renderVariable_1.default;
var utils_1 = require("./utils/utils");
Object.defineProperty(exports, "isEmptyReactFragment", { enumerable: true, get: function () { return utils_1.isEmptyReactFragment; } });
//# sourceMappingURL=internal.js.map
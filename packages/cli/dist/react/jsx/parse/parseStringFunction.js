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
exports.attributes = void 0;
exports.parseStrings = parseStrings;
const generaltranslation_1 = require("generaltranslation");
const t = __importStar(require("@babel/types"));
const evaluateJsx_1 = require("../evaluateJsx");
const warnings_1 = require("../../../console/warnings");
const generator_1 = __importDefault(require("@babel/generator"));
exports.attributes = ['id', 'context'];
/**
 * For the following example code:
 * const tx = useGT();
 * tx('string to translate', { id: 'exampleId', context: 'exampleContext' });
 *
 * This function will find all call expressions of useGT(), then find all call expressions
 * of the subsequent tx() calls, and append the content and metadata to the updates array.
 */
function parseStrings(importName, path, updates, errors, file) {
    var _a;
    (_a = path.scope.bindings[importName]) === null || _a === void 0 ? void 0 : _a.referencePaths.forEach((refPath) => {
        var _a;
        // Find call expressions of useGT() / await getGT()
        const callExpr = refPath.findParent((p) => p.isCallExpression());
        if (callExpr) {
            // Get the parent, handling both await and non-await cases
            const parentPath = callExpr.parentPath;
            const effectiveParent = (parentPath === null || parentPath === void 0 ? void 0 : parentPath.node.type) === 'AwaitExpression'
                ? parentPath.parentPath
                : parentPath;
            if (effectiveParent &&
                effectiveParent.node.type === 'VariableDeclarator' &&
                effectiveParent.node.id.type === 'Identifier') {
                const tFuncName = effectiveParent.node.id.name;
                // Get the scope from the variable declaration
                const variableScope = effectiveParent.scope;
                (_a = variableScope.bindings[tFuncName]) === null || _a === void 0 ? void 0 : _a.referencePaths.forEach((tPath) => {
                    if (tPath.parent.type === 'CallExpression' &&
                        tPath.parent.arguments.length > 0) {
                        const arg = tPath.parent.arguments[0];
                        if (arg.type === 'StringLiteral' ||
                            (t.isTemplateLiteral(arg) && arg.expressions.length === 0)) {
                            const source = arg.type === 'StringLiteral'
                                ? arg.value
                                : arg.quasis[0].value.raw;
                            // split the string into content (same as runtime behavior)
                            const content = (0, generaltranslation_1.splitStringToContent)(source);
                            // get metadata and id from options
                            const options = tPath.parent.arguments[1];
                            let metadata = {};
                            if (options && options.type === 'ObjectExpression') {
                                options.properties.forEach((prop) => {
                                    if (prop.type === 'ObjectProperty' &&
                                        prop.key.type === 'Identifier') {
                                        const attribute = prop.key.name;
                                        if (exports.attributes.includes(attribute) &&
                                            t.isExpression(prop.value)) {
                                            const result = (0, evaluateJsx_1.isStaticExpression)(prop.value);
                                            if (!result.isStatic) {
                                                errors.push((0, warnings_1.warnNonStaticExpression)(file, attribute, (0, generator_1.default)(prop.value).code));
                                            }
                                            if (result.isStatic && result.value) {
                                                metadata[attribute] = result.value;
                                            }
                                        }
                                    }
                                });
                            }
                            updates.push({
                                type: 'JSX',
                                source: content,
                                metadata,
                            });
                        }
                        else if (t.isTemplateLiteral(arg)) {
                            // warn if template literal
                            errors.push((0, warnings_1.warnTemplateLiteral)(file, (0, generator_1.default)(arg).code));
                        }
                    }
                });
            }
        }
    });
}

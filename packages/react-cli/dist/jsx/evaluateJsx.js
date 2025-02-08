'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.isMeaningful = isMeaningful;
exports.isStaticExpression = isStaticExpression;
exports.isStaticValue = isStaticValue;
const t = __importStar(require('@babel/types'));
const MEANINGFUL_REGEX = /[\p{L}\p{N}]/u;
/**
 * Checks if a node is meaningful. Does not recurse into children.
 * @param node - The node to check
 * @returns Whether the node is meaningful
 */
function isMeaningful(node) {
  if (t.isStringLiteral(node) || t.isJSXText(node)) {
    return MEANINGFUL_REGEX.test(node.value);
  }
  // Handle template literals without expressions
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return MEANINGFUL_REGEX.test(node.quasis[0].value.raw);
  }
  if (t.isJSXExpressionContainer(node)) {
    const value = isStaticExpression(node.expression);
    if (value.isStatic && value.value) {
      return MEANINGFUL_REGEX.test(value.value);
    }
  }
  if (t.isBinaryExpression(node)) {
    if (node.operator === '+') {
      return isMeaningful(node.left) || isMeaningful(node.right);
    }
  }
  return false;
}
/**
 * Checks if an expression is static (does not contain any variables which could change at runtime).
 * @param expr - The expression to check
 * @returns An object containing the result of the static check
 */
function isStaticExpression(expr) {
  // Handle empty expressions
  if (t.isJSXEmptyExpression(expr)) {
    return { isStatic: true, value: '' };
  }
  // Handle direct string literals
  if (t.isStringLiteral(expr)) {
    return { isStatic: true, value: expr.value };
  }
  // Handle template literals without expressions
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    return { isStatic: true, value: expr.quasis[0].value.raw };
  }
  // Handle binary expressions (string concatenation)
  if (t.isBinaryExpression(expr)) {
    // Only handle string concatenation
    if (expr.operator !== '+') {
      return { isStatic: false };
    }
    // Type guard to ensure we only process Expression types
    if (t.isExpression(expr.left) && t.isExpression(expr.right)) {
      const left = isStaticExpression(expr.left);
      const right = isStaticExpression(expr.right);
      if (
        left.isStatic &&
        right.isStatic &&
        left.value !== undefined &&
        right.value !== undefined
      ) {
        return { isStatic: true, value: left.value + right.value };
      }
    }
  }
  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(expr)) {
    return isStaticExpression(expr.expression);
  }
  // Handle numeric literals by converting them to strings
  if (t.isNumericLiteral(expr)) {
    return { isStatic: true, value: String(expr.value) };
  }
  // Handle boolean literals by converting them to strings
  if (t.isBooleanLiteral(expr)) {
    return { isStatic: true, value: String(expr.value) };
  }
  // Handle null literal
  if (t.isNullLiteral(expr)) {
    return { isStatic: true, value: 'null' };
  }
  // Not a static expression
  return { isStatic: false };
}
function isStaticValue(expr) {
  if (t.isStringLiteral(expr)) {
    return true;
  }
  if (t.isNumericLiteral(expr)) {
    return true;
  }
  if (t.isTemplateLiteral(expr)) {
    return true;
  }
  return false;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getDefaultFromEnv;
/**
 * Retrieves the value of an environment variable as a string.
 *
 * This function checks if the `process` object is defined and if the specified environment
 * variable is set. If both conditions are met, it returns the value of the environment
 * variable. If not, it returns an empty string.
 *
 * @param {string} VARIABLE - The name of the environment variable to retrieve.
 * @returns {string} The value of the environment variable, or an empty string if the variable is not set.
 */
function getDefaultFromEnv(VARIABLE) {
    var _a;
    if (typeof process !== 'undefined' && ((_a = process === null || process === void 0 ? void 0 : process.env) === null || _a === void 0 ? void 0 : _a[VARIABLE])) {
        return process.env[VARIABLE];
    }
    return '';
}
//# sourceMappingURL=getDefaultFromEnv.js.map
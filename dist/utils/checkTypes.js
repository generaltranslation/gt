"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTranslationPromise = isTranslationPromise;
// Check if the target is a TranslationPromise
function isTranslationPromise(target) {
    if (typeof target !== 'object' || target === null) {
        return false;
    }
    var hasPromise = 'promise' in target && target.promise instanceof Promise;
    var hasHash = 'hash' in target && typeof target.hash === 'string';
    var hasType = 'type' in target && (target.type === 'jsx' || target.type === 'content');
    return hasPromise && hasHash && hasType;
}
//# sourceMappingURL=checkTypes.js.map
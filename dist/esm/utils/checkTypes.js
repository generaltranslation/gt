// Check if the target is a TranslationPromise
export function isTranslationPromise(target) {
    if (typeof target !== 'object' || target === null) {
        return false;
    }
    var hasPromise = 'promise' in target && target.promise instanceof Promise;
    var hasErrorFallback = 'errorFallback' in target;
    var hasLoadingFallback = 'loadingFallback' in target;
    var hasHash = 'hash' in target && typeof target.hash === 'string';
    var hasType = 'type' in target && (target.type === 'jsx' || target.type === 'content');
    return hasPromise && hasErrorFallback && hasLoadingFallback && hasHash && hasType;
}
//# sourceMappingURL=checkTypes.js.map
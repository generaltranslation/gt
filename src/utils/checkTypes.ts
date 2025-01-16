import {  TranslationPromise } from "../types/types";


// Check if the target is a TranslationPromise
export function isTranslationPromise(target: unknown): target is TranslationPromise  {
  if (typeof target !== 'object' || target === null) {
    return false;
  }
  const hasPromise = 'promise' in target && target.promise instanceof Promise;
  const hasErrorFallback = 'errorFallback' in target;
  const hasLoadingFallback = 'loadingFallback' in target;
  const hasHash = 'hash' in target && typeof target.hash === 'string';
  const hasType = 'type' in target && (target.type === 'jsx' || target.type === 'content');

  return hasPromise && hasErrorFallback && hasLoadingFallback && hasHash && hasType;
}


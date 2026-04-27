import { TransformState } from '../../state/types';
import hashSource from '../../utils/calculateHash';
import type { DataFormat } from 'generaltranslation/types';

/**
 * Track standalone string translation invocations such as t() and msg().
 */
export function registerStandaloneTranslation({
  state,
  content,
  context,
  id,
  maxChars,
  hash,
  format,
  injectHash,
}: {
  state: TransformState;
  content: string;
  context?: string;
  id?: string;
  maxChars?: number;
  hash?: string;
  format?: string;
  injectHash?: boolean;
}): void {
  hash ??= hashSource({
    source: content,
    ...(id && { id }),
    ...(context && { context }),
    ...(maxChars != null && { maxChars }),
    dataFormat: (format || 'ICU') as DataFormat,
  });

  state.stringCollector.pushRuntimeOnlyContent({
    message: content,
    hash,
    id,
    context,
    maxChars,
    format,
  });

  // Runtime-only entries, including msg() and t`...`, stop here. Only
  // standalone t() sets injectHash so the injection pass sees a matching slot.
  if (!injectHash) {
    return;
  }

  const counterId = state.stringCollector.incrementCounter();
  state.stringCollector.setTranslationHash(counterId, {
    hash,
  });
}

import { createDiagnosticMessage } from 'generaltranslation/internal';
import logger from '../logs/logger';
import type { DictionaryConfig } from './types';

export function validateDictionaryConfig(params: DictionaryConfig): void {
  if (!params.loadDictionary || params.dictionary) return;

  logger.error(
    'I18nCache: ' +
      createDiagnosticMessage({
        whatHappened: 'loadDictionary needs a source dictionary',
        fix: 'Provide dictionary so the default locale has source content',
      })
  );
  throw new Error('Validation errors occurred');
}

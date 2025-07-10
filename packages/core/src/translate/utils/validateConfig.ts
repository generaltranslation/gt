import { translationLogger } from 'src/logging/logger';
import { TranslationRequestConfig } from '../../types';
import { translationMissingAuthError } from 'src/logging/errors';

export default function validateConfig(config: TranslationRequestConfig) {
  if (!config.projectId || !config.apiKey) {
    translationLogger.error('Translation request failed', {
      error: translationMissingAuthError,
    });
    throw new Error(translationMissingAuthError);
  }
}

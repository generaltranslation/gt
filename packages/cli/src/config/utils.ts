import { Settings } from '../types/index.js';

// returns true if the project is configured to use local translations
export function isUsingLocalTranslations(settings: Settings): boolean {
  return !!(settings.files && settings.files.placeholderPaths.gt);
}

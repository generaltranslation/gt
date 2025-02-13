import { TranslationsObject } from 'gt-react/internal';
type RemoteLoadTranslationInput = {
    targetLocale: string;
    projectId?: string;
    cacheUrl?: string | null;
    _versionId?: string;
};
/**
 * Loads the translations for the user's current locale.
 * Supports custom translation loaders.
 *
 * @returns {Promise<TranslationsObject | undefined>} The translation object or undefined if not found or errored
 *
 */
export default function loadTranslation(props: RemoteLoadTranslationInput): Promise<TranslationsObject | undefined>;
export {};
//# sourceMappingURL=loadTranslation.d.ts.map
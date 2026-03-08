import { resolveCanonicalLocale } from 'generaltranslation';
import { TranslationsLoader } from './types';
import { Translations } from '../utils/types/translation-data';
import { CustomMapping } from 'generaltranslation/types';

type CreateLocalTranslationLoaderParams = {
  translationOutputPath: string;
  customMapping?: CustomMapping;
};

/**
 * Creates a translations loader that reads from local JSON files on the filesystem.
 * The translationOutputPath should contain a [locale] placeholder that gets replaced
 * with the target locale (e.g., "public/_gt/[locale].json").
 */
export function createLocalTranslationLoader(
  params: CreateLocalTranslationLoaderParams
): TranslationsLoader {
  const loader: TranslationsLoader = async (locale: string) => {
    locale = resolveCanonicalLocale(locale, params.customMapping);
    const filePath = params.translationOutputPath.replace('[locale]', locale);
    const { promises: fsPromises } = await import('fs');
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Translations;
  };

  return loader;
}

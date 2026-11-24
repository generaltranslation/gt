import { useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  getGTContext,
  getSeededTranslationsContext,
  mergeTranslations,
  type TranslationsSnapshot,
} from './context';

type InternalTranslationsSeedProps = {
  children?: ReactNode;
  translations: TranslationsSnapshot;
};

const GTContext = getGTContext();
const SeededTranslationsContext = getSeededTranslationsContext();

/**
 * Adds translations to those of the provider above it, and to those of any
 * provider below it.
 */
export function InternalTranslationsSeed({
  children,
  translations,
}: InternalTranslationsSeedProps) {
  const parent = useContext(GTContext);
  const parentSeededTranslations = useContext(SeededTranslationsContext);
  const seededTranslations = useMemo(
    () =>
      parentSeededTranslations
        ? mergeTranslations(parentSeededTranslations, translations)
        : translations,
    [parentSeededTranslations, translations]
  );
  const value = useMemo(
    () =>
      parent && {
        ...parent,
        translationsSnapshot: mergeTranslations(
          parent.translationsSnapshot,
          translations
        ),
      },
    [parent, translations]
  );

  useEffect(() => {
    parent?.i18nStore.updateTranslations(translations);
  }, [parent, translations]);

  const seeded = (
    <SeededTranslationsContext.Provider value={seededTranslations}>
      {children}
    </SeededTranslationsContext.Provider>
  );
  return value ? (
    <GTContext.Provider value={value}>{seeded}</GTContext.Provider>
  ) : (
    seeded
  );
}

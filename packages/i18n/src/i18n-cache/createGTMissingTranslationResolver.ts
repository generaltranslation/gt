import type { RuntimeTranslateManyOptions } from 'generaltranslation/internal';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import type { Translation } from './translations-manager/utils/types/translation-data';
import {
  createBatchedMissingTranslationResolver,
  type CreateMissingTranslationResolver,
} from './translations-manager/MissingTranslationResolver';
import { createTranslateManyFactory } from './translations-manager/utils/createTranslateMany';
import type { I18nCacheConstructorParams } from './types';

const DEFAULT_TRANSLATION_TIMEOUT = 12_000;

type GTMissingTranslationResolverParams = Pick<
  I18nCacheConstructorParams,
  'batchConfig' | 'modelProvider' | 'runtimeTranslation'
>;

export function createGTMissingTranslationResolver<
  TranslationValue extends Translation = Translation,
>({
  batchConfig,
  modelProvider,
  runtimeTranslation,
}: GTMissingTranslationResolverParams): CreateMissingTranslationResolver<TranslationValue> {
  const metadata: RuntimeTranslateManyOptions = {
    ...(modelProvider && { modelProvider }),
    ...runtimeTranslation?.metadata,
  };
  const createTranslateMany = createTranslateManyFactory(
    getI18nConfig().getGTClass(),
    runtimeTranslation?.timeout ?? DEFAULT_TRANSLATION_TIMEOUT,
    metadata
  );

  return (locale) =>
    createBatchedMissingTranslationResolver<TranslationValue>(
      createTranslateMany(locale),
      batchConfig
    );
}

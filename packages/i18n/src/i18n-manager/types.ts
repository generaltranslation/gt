import { CustomMapping } from 'generaltranslation/types';
import { GTConfig } from '../config/types';
import { TranslationsManagerConstructorParams } from './translations-manager/utils/types/translations-manager';

/**
 * Parameters for the I18nManager constructor
 */
export type I18nManagerConstructorParams = GTConfig &
  Pick<TranslationsManagerConstructorParams, 'customTranslationLoader'>;

/**
 * I18nManager class configuration
 */
export type I18nManagerConfig = {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
  enableI18n: boolean;
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  runtimeUrl?: string | null;
};

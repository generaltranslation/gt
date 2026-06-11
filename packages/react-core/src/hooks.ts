// React hook entrypoint. This is context-capable and intentionally not
// RSC-safe.

export { useConditionStore, useLocale, useEnableI18n } from './hooks/condition-store';
export {
  useCustomMapping,
  useDefaultLocale,
  useLocales,
} from './hooks/i18n-config';
export { useGT } from './hooks/useGT';
export { useMessages } from './hooks/useMessages';
export { useTranslations } from './hooks/useTranslations';
export { useFormatLocales } from './hooks/utils';
export { useInternalLocaleSelector } from './hooks/useInternalLocaleSelector';


export function useLocaleDirection() {
  throw new Error('useLocaleDirection not yet implemented');
}
export function useVersionId() {
  throw new Error('useVersionId not yet implemented');
}
export function useGTClass() {
  throw new Error('useGTClass not yet implemented');
}
export function useLocaleProperties(locale: string) {
  throw new Error('useLocaleProperties not yet implemented');
}
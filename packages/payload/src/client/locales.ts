import { useConfig } from '@payloadcms/ui';
import {
  ADMIN_CUSTOM_KEY,
  targetLocaleOptions,
  type AdminSettings,
  type LocaleOption,
} from '../locales';

export type { LocaleOption };

// The languages to offer, from Payload's locales and the plugin's settings.
export function useLocaleOptions(): LocaleOption[] {
  const { config } = useConfig();
  const settings = (
    config.admin.custom as Record<string, AdminSettings | undefined> | undefined
  )?.[ADMIN_CUSTOM_KEY];
  return targetLocaleOptions(config.localization, settings?.customMapping);
}

export function localeNames(codes: string[], options: LocaleOption[]): string {
  return codes
    .map((code) => options.find((o) => o.code === code)?.name ?? code)
    .join(', ');
}

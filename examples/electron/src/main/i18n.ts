import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getLocale, getLocaleProperties, getLocales, t } from 'gt-i18n';
import { initializeGT } from 'gt-i18n/standalone';
import type { MenuItemConstructorOptions } from 'electron';

/**
 * Sets GT up for the main process. `preferred` lists the locale saved from the
 * last run, then the system's languages; GT starts in the first one it supports.
 */
export async function startI18n(appPath: string, preferred: string[]) {
  const config = JSON.parse(
    await readFile(path.join(appPath, 'gt.config.json'), 'utf8')
  );
  await initializeGT({
    ...config,
    locale: preferred,
    loadTranslations: async (locale) =>
      JSON.parse(
        await readFile(path.join(appPath, 'src/_gt', `${locale}.json`), 'utf8')
      ),
  });
}

/**
 * The application menu in the current locale. A menu is built from strings, so
 * it is built again after each locale change.
 */
export function menuTemplate(
  changeLocale: (locale: string) => void
): MenuItemConstructorOptions[] {
  return [
    { role: 'appMenu' },
    {
      label: t`Language`,
      submenu: getLocales().map((locale) => ({
        label: getLocaleProperties(locale).nativeName,
        type: 'radio',
        checked: locale === getLocale(),
        click: () => changeLocale(locale),
      })),
    },
  ];
}

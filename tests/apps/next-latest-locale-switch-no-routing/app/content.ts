export const contentByLocale = {
  en: 'English content',
  fr: 'Contenu français',
  de: 'Deutscher Inhalt',
} as const;

export function getContent(locale: string) {
  return contentByLocale[locale as keyof typeof contentByLocale] ?? locale;
}

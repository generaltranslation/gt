export const contentByLocale = {
  'en-us': 'American English content',
  'en-gb': 'British English content',
  'fr-fr': 'Contenu français',
  'de-de': 'Deutscher Inhalt',
} as const;

export function getContent(locale: string) {
  return contentByLocale[locale as keyof typeof contentByLocale] ?? locale;
}

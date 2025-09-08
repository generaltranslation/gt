import { Adapter, Secrets } from 'sanity-translations-tab';

// note: this function is used to get the available locales for a project
export const getLocales: Adapter['getLocales'] = async (
  secrets: Secrets | null
) => {
  let locales: {
    localeId: string;
    description: string;
    enabled?: boolean;
  }[] = [];
  return [
    { localeId: 'en', description: 'English', enabled: true },
    { localeId: 'es', description: 'Spanish', enabled: true },
  ];
};

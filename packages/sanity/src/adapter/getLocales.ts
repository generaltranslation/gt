import { Adapter, Secrets } from 'sanity-translations-tab';
import { gt } from './core';

// note: this function is used to get the available locales for a project
export const getLocales: Adapter['getLocales'] = async (
  secrets: Secrets | null
) => {
  if (!secrets?.project) {
    return [];
  }
  const data = await gt.getProjectData(secrets?.project);
  return data.currentLocales.map((locale: string) => ({
    localeId: locale,
    description: gt.getLocaleProperties(locale).languageName,
    enabled: true,
  }));
};

import { GT } from 'generaltranslation';

export default async function fetchTranslations({
  cacheUrl,
  projectId,
  locale,
  versionId,
  gt,
}: {
  cacheUrl: string;
  projectId: string;
  locale: string;
  versionId?: string;
  gt: GT;
}) {
  if (!projectId || !cacheUrl || !locale) return {};
  locale = gt.resolveCanonicalLocale(locale);
  const response = await fetch(
    versionId
      ? `${cacheUrl}/${projectId}/${locale}/${versionId}`
      : `${cacheUrl}/${projectId}/${locale}`
  ); // fetch from cache
  const result = await response.json();
  return result;
}

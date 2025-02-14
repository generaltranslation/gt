export default async function fetchTranslations({
  cacheUrl, projectId, locale, versionId
}: {
  cacheUrl: string,
  projectId: string,
  locale: string,
  versionId?: string
}) {
  const response = await fetch(
    versionId
      ? `${cacheUrl}/${projectId}/${locale}/${versionId}`
      : `${cacheUrl}/${projectId}/${locale}`
  ); // fetch from cache
  const result = await response.json();
  return result;
}

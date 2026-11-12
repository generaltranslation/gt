import { getTranslations } from 'gt-next/compat/server';

export default async function Page() {
  const d = await getTranslations();
  return <>{d('greeting')}</>;
}

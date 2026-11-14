import { useTranslations } from 'gt-next/compat';

export default function Page() {
  const d = useTranslations();
  return <>{d('greeting')}</>;
}

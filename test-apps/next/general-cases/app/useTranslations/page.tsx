import { useTranslations } from 'gt-next';

export default function Page() {
  const d = useTranslations();
  return <>{d('greeting')}</>;
}

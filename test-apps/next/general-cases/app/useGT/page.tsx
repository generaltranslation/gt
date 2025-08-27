import { useGT } from 'gt-next';

export default function Page() {
  const t = useGT();
  return <>{t('Hello')}</>;
}

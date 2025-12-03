import { getRootParam } from '@generaltranslation/next-internal';

export default function DashboardSettingsPage() {
  const locale = getRootParam('locale');

  return (
    <div>
      <h1>Dashboard Settings Test Page</h1>
      <div data-testid='locale-result'>{locale !== undefined ? JSON.stringify(locale) : 'undefined'}</div>
    </div>
  );
}

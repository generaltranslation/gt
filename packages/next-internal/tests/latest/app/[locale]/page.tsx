import { getRootParam } from '@generaltranslation/next-internal';

export default function LocalePage() {
  const locale = getRootParam('locale');
  const nonexistent = getRootParam('nonexistent');
  const localeWithHighIndex = getRootParam('locale', 10);

  return (
    <div>
      <h1>Locale Test Page</h1>
      <div data-testid='locale-result'>{locale !== undefined ? JSON.stringify(locale) : 'undefined'}</div>
      <div data-testid='nonexistent-result'>{nonexistent !== undefined ? JSON.stringify(nonexistent) : 'undefined'}</div>
      <div data-testid='high-index-result'>
        {localeWithHighIndex !== undefined ? JSON.stringify(localeWithHighIndex) : 'undefined'}
      </div>
    </div>
  );
}

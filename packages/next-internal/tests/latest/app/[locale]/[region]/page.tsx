import { getRootParam } from '@generaltranslation/next-internal';

export default function LocaleRegionPage() {
  const locale = getRootParam('locale');
  const region = getRootParam('region');
  const regionExplicit = getRootParam('region', 2);

  return (
    <div>
      <h1>Locale and Region Test Page</h1>
      <div data-testid='locale-result'>{locale !== undefined ? JSON.stringify(locale) : 'undefined'}</div>
      <div data-testid='region-result'>{region !== undefined ? JSON.stringify(region) : 'undefined'}</div>
      <div data-testid='region-explicit-result'>
        {regionExplicit !== undefined ? JSON.stringify(regionExplicit) : 'undefined'}
      </div>
    </div>
  );
}

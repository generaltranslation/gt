// Type-level tests, checked by `tsc --noEmit` (not run by vitest).
import { LocaleSelector, RegionSelector } from '../../index.types';

export const selectors = [
  <LocaleSelector locales={['en-US']} className='locale' disabled />,
  <RegionSelector
    regions={['US']}
    className='region'
    placeholder={<b>Region</b>}
  />,

  // @ts-expect-error the selector sets the locale itself
  <LocaleSelector setLocale={42} />,
  // @ts-expect-error the selector handles changes itself
  <LocaleSelector onChange={() => undefined} />,
  // @ts-expect-error the selector sets the region itself
  <RegionSelector setRegion={(region: string) => region} />,
  // @ts-expect-error the selector controls its value
  <RegionSelector value='US' />,
];

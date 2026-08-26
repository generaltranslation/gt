import { BrowserGTProvider as BrowserGTProviderDev } from './BrowserGTProvider';
import { BrowserGTProviderProd } from './BrowserGTProvider.prod';

export const BrowserGTProvider =
  process.env.NODE_ENV === 'production'
    ? BrowserGTProviderProd
    : BrowserGTProviderDev;

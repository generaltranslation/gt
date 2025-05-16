'use client';

import { cookieConsentGiven } from '@/components/analytics/cookie-banner';
import CookieBanner from '@/components/analytics/cookie-banner';

export default function AnalyticsBanner() {
  const consentGiven = cookieConsentGiven();

  if (consentGiven === 'yes' || consentGiven === 'no') {
    return null;
  }

  return <CookieBanner />;
}

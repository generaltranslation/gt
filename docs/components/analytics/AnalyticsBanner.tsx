'use client';

import CookieBanner from '@/components/analytics/cookie-banner';
import { useEffect, useState } from 'react';
import { cookieConsentGiven } from '@/components/analytics/cookie-banner';

// Purpose of this component is to avoid unnecessary calls of feature flags
// if the user has already given consent.
export default function AnalyticsBanner() {
  const [browserLoaded, setBrowserLoaded] = useState(false);
  const [consentGiven, setConsentGiven] = useState<'yes' | 'no' | undefined>(
    undefined
  );
  useEffect(() => {
    setBrowserLoaded(true);
    setConsentGiven(cookieConsentGiven());
  }, []);

  if (!browserLoaded) {
    return null;
  }

  if (consentGiven === 'yes' || consentGiven === 'no') {
    return null;
  }

  return <CookieBanner />;
}

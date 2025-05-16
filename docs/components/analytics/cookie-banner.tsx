'use client';
import { useEffect, useState } from 'react';
import { useFeatureFlagEnabled, usePostHog } from 'posthog-js/react';
import { Button } from '@/components/ui/button';
import { T } from 'gt-next/client';

export function cookieConsentGiven(): 'yes' | 'no' | undefined {
  if (!document.cookie.includes('cookie_consent')) {
    return undefined;
  }
  return document.cookie.includes('cookie_consent=yes') ? 'yes' : 'no';
}

export function setCookieConsent(consent: 'yes' | 'no') {
  document.cookie = `cookie_consent=${consent}; path=/; max-age=31536000`; // 1 year expiry
}

export default function CookieBanner() {
  const [consentGiven, setConsentGiven] = useState<'yes' | 'no' | 'undecided'>(
    'undecided'
  );
  const isEU = useFeatureFlagEnabled('eu-cookie-banner') ?? false;
  console.log('isEU', isEU);
  const posthog = usePostHog();

  useEffect(() => {
    // We want this to only run once the client loads
    // or else it causes a hydration error
    setConsentGiven(cookieConsentGiven() ?? 'undecided');
  }, []);

  useEffect(() => {
    if (consentGiven !== 'undecided') {
      posthog.set_config({
        persistence: consentGiven === 'yes' ? 'cookie' : 'memory',
      });
    }
  }, [consentGiven]);

  useEffect(() => {
    if (isEU === undefined) return;

    const storedConsent = cookieConsentGiven();

    if (isEU === false) {
      if (!storedConsent) {
        setCookieConsent('yes');
      }
      setConsentGiven(storedConsent ?? 'yes');
      return;
    } else {
      setConsentGiven(storedConsent ?? 'undecided');
      return;
    }
  }, [isEU]);

  const handleAcceptCookies = () => {
    setCookieConsent('yes');
    setConsentGiven('yes');
  };

  const handleDeclineCookies = () => {
    setCookieConsent('no');
    setConsentGiven('no');
  };

  if (!isEU) return null;

  return (
    <div>
      <T>
        <div>
          <p>
            We use tracking cookies to understand how you use the product and
            help us improve it. Please accept cookies to help us improve.
          </p>
          <Button onClick={handleAcceptCookies} variant="outline">
            Accept cookies
          </Button>
          <span> </span>
          <Button onClick={handleDeclineCookies} variant="outline">
            Decline cookies
          </Button>
        </div>
      </T>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useFeatureFlagEnabled, usePostHog } from 'posthog-js/react';
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
  const isEU = useFeatureFlagEnabled('eu-cookie-banner');
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

  if (consentGiven !== 'undecided') return null;

  return (
    <div
      className="fixed bottom-4 right-4 max-w-sm p-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg z-[9999] border border-gray-200 dark:border-gray-700"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 9999,
      }}
    >
      <T>
        <div className="flex flex-col max-w-sm">
          <div className="pb-4">
            <p>
              We use tracking cookies to understand how you use our website and
              help us improve it. Please accept cookies to help us improve.
            </p>
          </div>
          <div className="flex justify-between gap-x-4 gap-6 mt-6">
            <button
              onClick={handleAcceptCookies}
              className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 font-medium shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Accept cookies
            </button>
            <button
              onClick={handleDeclineCookies}
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Decline cookies
            </button>
          </div>
        </div>
      </T>
    </div>
  );
}

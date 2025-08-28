import { cookies, headers } from 'next/headers';
import { determineLocale } from 'generaltranslation';
import getI18NConfig from '../config-dir/getI18NConfig';
import { noLocalesCouldBeDeterminedWarning } from '../errors/createErrors';

/**
 * Retrieves the 'accept-language' header from the headers list.
 * If the 'next/headers' module is not available, it attempts to load it. If the
 * headers function is available, it returns the primary language from the 'accept-language'
 * header.
 *
 * @returns {Promise<string>} A promise that resolves to the primary language from the
 * 'accept-language' header.
 */
export async function getNextLocale(
  defaultLocale: string = '',
  locales: string[]
): Promise<string> {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);

  const I18NConfig = getI18NConfig();

  // Read params from root-params
  const pathLocale = await getRootParams();

  const userLocale = (() => {
    const preferredLocales: string[] = [];

    // Language routed to by middleware
    const headerLocale = headersList.get(I18NConfig.getLocaleHeaderName());
    if (headerLocale) {
      preferredLocales.push(headerLocale);
    }
    const cookieLocale = cookieStore.get(I18NConfig.getLocaleCookieName());
    if (cookieLocale?.value) {
      preferredLocales.push(cookieLocale.value);
    }

    // Browser languages, in preference order
    if (process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'false') {
      const acceptedLocales = headersList
        .get('accept-language')
        ?.split(',')
        .map((item) => item.split(';')?.[0].trim());

      if (acceptedLocales) preferredLocales.push(...acceptedLocales);
    }

    // Add locale from path
    if (pathLocale) {
      preferredLocales.push(pathLocale);
    }

    // Give a warning here
    if (preferredLocales.length === 0) {
      console.warn(noLocalesCouldBeDeterminedWarning);
    }

    // add defaultLocale just in case there are no matches
    preferredLocales.push(defaultLocale);

    const result = determineLocale(preferredLocales, locales) || defaultLocale;

    return result;
  })();

  return userLocale;
}

async function viaExperimentalModule(): Promise<string | null> {
  try {
    // @ts-ignore - next/root-params may not exist in all Next.js versions
    const mod = await import('next/root-params');

    const maybeFns = ['lang', 'locale'] as const;
    const entries = await Promise.all(
      maybeFns.map(async (k): Promise<readonly [string, string] | null> => {
        const fn = (mod as Record<string, unknown>)[k];
        if (typeof fn === 'function') {
          try {
            const v = await fn();
            return typeof v === 'string' ? ([k, v] as const) : null;
          } catch {
            return null;
          }
        }
        return null;
      })
    );

    for (const entry of entries) {
      if (entry) return entry[1];
    }
    return null;
  } catch {
    return null;
  }
}

async function viaUnstableModule(): Promise<string | null> {
  try {
    const { unstable_rootParams } = await import('next/server');
    if (typeof unstable_rootParams !== 'function') return null;
    const params = await unstable_rootParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (k === 'locale') {
        if (typeof v === 'string') return v;
      }
      if (k === 'lang') {
        if (typeof v === 'string') return v;
      }
    }
  } catch {
    /* empty */
  }
  return null;
}

/**
 * Server-only helper that returns root params across Next versions.
 * Uses environment variable to optimize API selection.
 */
export async function getRootParams(): Promise<string | null> {
  const apiVersion = process.env._GENERALTRANSLATION_ROOT_PARAMS_STABILITY;

  // Skip expensive try/catch when we know API isn't available
  if (apiVersion === 'unsupported') {
    return null;
  }

  // Use new API for experimental/supported versions
  if (apiVersion === 'experimental' || apiVersion === 'supported') {
    const fromNew = await viaExperimentalModule();
    if (fromNew) return fromNew;
  }

  // Use unstable API for unstable versions or as fallback
  if (apiVersion === 'unstable' || !apiVersion) {
    const fromOld = await viaUnstableModule();
    if (fromOld) return fromOld;
  }

  return null;
}

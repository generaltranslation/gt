import { getRequest, setCookie } from '@tanstack/react-start/server';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { getCookieValue, parseAcceptLanguage } from 'gt-i18n/internal';
import { getLocaleFromPath } from './localeRouting';

type RequestConditions = {
  locale: string;
  enableI18n: boolean;
};

type RequestConditionState = {
  localeRouting: boolean;
  conditionsByRequest: WeakMap<Request, RequestConditions>;
};

type GlobalWithRequestConditions = {
  __generaltranslation?: {
    tanstackStart?: {
      requestConditions?: RequestConditionState;
    };
  };
};

const localeCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
};

const noLocaleCandidatesWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'No locale preference was found for the current request',
  reassurance: 'GT will use the configured default locale',
  why: 'neither the locale cookie nor the Accept-Language header supplied a supported locale candidate',
});

/** Configure request condition resolution during server initialization. */
export function initializeRequestConditions(localeRouting = false): void {
  const state = getRequestConditionState();
  state.localeRouting = localeRouting;
  state.conditionsByRequest = new WeakMap();
}

/** Return the memoized conditions for the current TanStack request. */
export function getRequestConditions(
  request = getRequest()
): RequestConditions {
  const state = getRequestConditionState();
  const existingConditions = state.conditionsByRequest.get(request);
  if (existingConditions) return existingConditions;

  const conditions = resolveRequestConditions(request, state.localeRouting);
  state.conditionsByRequest.set(request, conditions);
  return conditions;
}

function getRequestConditionState(): RequestConditionState {
  const globalObject = globalThis as GlobalWithRequestConditions;
  globalObject.__generaltranslation ??= {};
  globalObject.__generaltranslation.tanstackStart ??= {};
  return (globalObject.__generaltranslation.tanstackStart.requestConditions ??=
    {
      localeRouting: false,
      conditionsByRequest: new WeakMap(),
    });
}

function resolveRequestConditions(
  request: Request,
  localeRouting: boolean
): RequestConditions {
  const i18nConfig = getI18nConfig();
  const cookieHeader = request.headers.get('cookie');
  const localeCandidates: string[] = [];
  if (localeRouting) {
    const pathLocale = getLocaleFromPath(new URL(request.url).pathname);
    if (pathLocale) localeCandidates.push(pathLocale);
  }
  const cookieLocale = getCookieValue(
    cookieHeader,
    i18nConfig.getLocaleCookieName()
  );
  if (cookieLocale) localeCandidates.push(cookieLocale);
  localeCandidates.push(
    ...parseAcceptLanguage(request.headers.get('accept-language'))
  );

  if (localeCandidates.length === 0) {
    console.warn(noLocaleCandidatesWarning);
  }

  const locale = i18nConfig.resolveSupportedLocale(localeCandidates);

  setCookie(i18nConfig.getLocaleCookieName(), locale, localeCookieOptions);

  const enableI18nCookie = getCookieValue(
    cookieHeader,
    i18nConfig.getEnableI18nCookieName()
  );

  return {
    locale,
    enableI18n:
      enableI18nCookie === undefined ? true : enableI18nCookie === 'true',
  };
}

import type { LocaleConfig } from '@generaltranslation/format';
import type { UserTokenProvider } from '@generaltranslation/api';

/** Exactly one of an API key or a user-token provider. */
export type GTCredentials =
  | { apiKey: string; userTokenProvider?: never }
  | { userTokenProvider: UserTokenProvider; apiKey?: never };

/** `'project'` for a project API key, which works only with its project; otherwise `'account'`. */
export function credentialScope(
  credentials: GTCredentials
): 'project' | 'account' {
  return credentials.apiKey?.startsWith('gtx-api-') ? 'project' : 'account';
}

/**
 * Configuration for a project-scoped `GT` and for `GTRuntime`.
 *
 * @property projectId - The project.
 * @property localeConfig - The default locale, locales and custom mapping.
 * @property baseUrl - The API base URL.
 */
export type GTProjectConfig = GTCredentials & {
  projectId: string;
  localeConfig?: LocaleConfig;
  baseUrl?: string;
};

/**
 * Configuration for an account-scoped `GT`, which has no project.
 *
 * @property localeConfig - The default locale, locales and custom mapping.
 * @property baseUrl - The API base URL.
 */
export type GTAccountConfig = GTCredentials & {
  projectId?: never;
  localeConfig?: LocaleConfig;
  baseUrl?: string;
};

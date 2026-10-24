import { defaultBaseUrl } from 'generaltranslation/internal';

/** The GT API that requests go to: GT_API_URL, then the configured base URL, then the public API. */
export function resolveApiBaseUrl(configured?: string): string {
  return process.env.GT_API_URL || configured || defaultBaseUrl;
}

import { getEnvFileApiKey } from '../utils/loadEnv.js';
import { hasLogin } from './oauth.js';

/**
 * The API key the CLI sends. A GT_API_KEY from an env file is the app's
 * runtime key (gt init saves a translate-only key there for Next.js), so a
 * stored login acts for the CLI instead. A shell or CI GT_API_KEY stays
 * authoritative.
 */
export async function resolveCliApiKey(
  baseUrl: string
): Promise<string | undefined> {
  const apiKey = process.env.GT_API_KEY;
  if (!apiKey || apiKey !== getEnvFileApiKey()) return apiKey;
  const signedIn = await hasLogin({ baseUrl }).catch(() => false);
  return signedIn ? undefined : apiKey;
}

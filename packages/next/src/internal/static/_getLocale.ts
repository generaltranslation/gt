// Fallback when SSG enabled to skip next/headers import
import { RequestFunctionReturnType } from '../../request/types';

/**
 * @deprecated
 */
export default async function getLocale(): Promise<RequestFunctionReturnType> {
  return undefined;
}

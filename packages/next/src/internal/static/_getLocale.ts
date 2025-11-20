// Fallback when SSG enabled to skip next/headers import
import { RequestFunctionReturnType } from '../../request/types';

export default async function getLocale(): Promise<RequestFunctionReturnType> {
  return undefined;
}

// Internal route for getLocale() function
// If using SSG, this route will be replaced with a custom getLocale() function
import { getNextLocale } from '../../request/headers/getNextLocale';
import { RequestFunctionReturnType } from '../../request/types';

export default async function getLocale(): Promise<RequestFunctionReturnType> {
  return await getNextLocale();
}

// Internal route for getDomain() function
// If using SSG, this route will be replaced with a custom getDomain() function
import { getNextDomain } from '../request/headers/getNextDomain';
import { RequestFunctionReturnType } from '../request/types';

export default async function getDomain(): Promise<RequestFunctionReturnType> {
  return await getNextDomain();
}

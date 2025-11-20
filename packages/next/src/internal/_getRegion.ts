// Internal route for getRegion() function
// If using SSG, this route will be replaced with a custom getRegion() function
import { getNextRegion } from '../request/headers/getNextRegion';
import { RequestFunctionReturnType } from '../request/types';

export default async function getRegion(): Promise<RequestFunctionReturnType> {
  return await getNextRegion();
}

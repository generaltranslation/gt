import { cookies } from 'next/headers';
import { defaultRegionCookieName } from 'gt-react/internal';
import { RequestFunctionReturnType } from '../types';

export async function getNextRegion(): Promise<RequestFunctionReturnType> {
  const cookieStore = await cookies();
  const cookieRegion = cookieStore.get(defaultRegionCookieName)?.value;
  return cookieRegion;
}

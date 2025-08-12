import { cookies } from 'next/headers';
// import getI18NConfig from '../config-dir/getI18NConfig';
import { defaultRegionCookieName } from 'gt-react/internal';

export async function getNextRegion(): Promise<string | undefined> {
  const cookieStore = await cookies();
  // const I18NConfig = getI18NConfig();
  const cookieRegion = cookieStore.get(defaultRegionCookieName)?.value;
  return cookieRegion;
}

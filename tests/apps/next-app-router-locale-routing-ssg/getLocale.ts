import { locale } from 'next/root-params';

export async function getLocale() {
  return await locale();
}

export default getLocale;

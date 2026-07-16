import { locale } from 'next/root-params';

export async function getRegion() {
  return await locale();
}

export default getRegion;

import { locale } from 'next/root-params';

export default async function getLocale() {
  return await locale();
}
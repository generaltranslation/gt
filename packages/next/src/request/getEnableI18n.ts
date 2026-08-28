import { use } from '../utils/use';

export function getEnableI18n(): Promise<boolean> {
  return Promise.resolve(true);
}

export function useEnableI18n(): boolean {
  return use(getEnableI18n());
}

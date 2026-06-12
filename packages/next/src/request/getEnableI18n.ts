import { use } from '../utils/use';

// TODO: move this over to ConditionStore

export async function getEnableI18n(): Promise<boolean> {
  // TODO: read this from a request condition store once gt-next sets one up.
  return true;
}

export function useEnableI18n(): boolean {
  return use(getEnableI18n());
}

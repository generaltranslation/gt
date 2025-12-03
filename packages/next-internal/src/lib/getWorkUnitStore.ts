import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';

export function getWorkUnitStore(): any | undefined {
  return workUnitAsyncStorage.getStore();
}

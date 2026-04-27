import { AsyncLocalStorage } from 'async_hooks';

export const localeStore = new AsyncLocalStorage<string>();

import Var from './variables/Var';
import Num from './variables/Num';
import Currency from './variables/Currency';
import DateTime from './variables/DateTime';
import T from './server-dir/buildtime/T';
import Branch from './branches/Branch';
import Plural from './branches/Plural';
import GTProvider from './provider/GTProvider';
import { Tx } from './server';
import {
  createCustomComponentWithoutUseClientError,
  createCustomHookWithoutUseClientError,
} from './errors/createErrors';

export function useGT() {
  throw new Error(createCustomHookWithoutUseClientError('useGT'));
}

export function useTranslations() {
  throw new Error(createCustomHookWithoutUseClientError('useTranslations'));
}

export function useDict() {
  throw new Error(createCustomHookWithoutUseClientError('useDict'));
}

export function useGTClass() {
  throw new Error(createCustomHookWithoutUseClientError('useGTClass'));
}

export function useLocaleProperties() {
  throw new Error(createCustomHookWithoutUseClientError('useLocaleProperties'));
}

export function useLocale() {
  throw new Error(createCustomHookWithoutUseClientError('useLocale'));
}

export function useLocales() {
  throw new Error(createCustomHookWithoutUseClientError('useLocales'));
}

export function useSetLocale() {
  throw new Error(createCustomHookWithoutUseClientError('useSetLocale'));
}

export function useDefaultLocale() {
  throw new Error(createCustomHookWithoutUseClientError('useDefaultLocale'));
}

export function useLocaleSelector() {
  throw new Error(createCustomHookWithoutUseClientError('useLocaleSelector'));
}

export function LocaleSelector() {
  throw new Error(createCustomComponentWithoutUseClientError('LocaleSelector'));
}

export { GTProvider, T, Tx, Var, Num, Currency, DateTime, Branch, Plural };

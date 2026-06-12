import { use } from '../../utils/use';
import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import { getRequestConditions } from '../../request/getRequestConditions';

export async function getGT() {
  const conditions = await getRequestConditions();
  return getGTInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
  });
}

export async function getMessages() {
  const conditions = await getRequestConditions();
  return getMessagesInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
  });
}

export async function getTranslations() {
  const conditions = await getRequestConditions();
  return getTranslationsInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
  });
}

export function useGT() {
  return use(getGT());
}

export function useMessages() {
  return use(getMessages());
}

export function useTranslations() {
  return use(getTranslations());
}
import { use } from 'react';
import { getFormatLocales } from '@generaltranslation/react-core/pure';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getI18nConfig } from 'gt-i18n/internal';
import type { GT, M } from 'gt-i18n';
import { ensureInitialized } from 'gt-tanstack-start/internal/initializeGT.server';
import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
} from '../functions/runtime.server';

// A server component may be the first GT code of a server process: a
// navigation's server function runs without the router that sets GT up.
function getConfig() {
  ensureInitialized();
  return getI18nConfig();
}

/** Returns a GT bound to the request locale once its translations load. */
export function useGT(): GT {
  return use(getGT());
}

/** Returns an m bound to the request locale once its translations load. */
export function useMessages(): M {
  return use(getMessages());
}

export function useLocale(): string {
  return getLocale();
}

export function useEnableI18n(): boolean {
  return getEnableI18n();
}

export function useFormatLocales(): string[] {
  return getFormatLocales({
    locale: getLocale(),
    enableI18n: getEnableI18n(),
  });
}

export function useLocales(): string[] {
  return getConfig().getLocales();
}

export function useDefaultLocale(): string {
  return getConfig().getDefaultLocale();
}

export function useCustomMapping() {
  return getConfig().getCustomMapping();
}

const createClientHookError = (name: string) =>
  createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Error',
    whatHappened: `${name}() cannot be called in a server component`,
    why: 'it changes state that only the browser has',
    fix: "Call it in a client component, a module that starts with 'use client'",
  });

export function useSetLocale(): never {
  throw new Error(createClientHookError('useSetLocale'));
}

export function useSetEnableI18n(): never {
  throw new Error(createClientHookError('useSetEnableI18n'));
}

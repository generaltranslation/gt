import { use } from 'react';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { GT, M } from 'gt-i18n';
import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
} from '../functions/runtime.server';

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

function failClientOnly(name: string): never {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-tanstack-start',
      severity: 'Error',
      whatHappened: `${name}() cannot be called in a server component`,
      why: 'it reads or changes state that only the browser or the router has',
      fix: "Call it in a client component, a module that starts with 'use client'",
    })
  );
}

export function useSetLocale(): never {
  return failClientOnly('useSetLocale');
}

export function useSetEnableI18n(): never {
  return failClientOnly('useSetEnableI18n');
}

export function useFormatLocales(): never {
  return failClientOnly('useFormatLocales');
}

export function setupRouterGTIntegration(): never {
  return failClientOnly('setupRouterGTIntegration');
}

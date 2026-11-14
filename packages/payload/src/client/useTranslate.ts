import { toast } from '@payloadcms/ui';
import {
  ApiError,
  isTransientApiError,
  type TranslateFilesErrors,
} from '@generaltranslation/api';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { useState } from 'react';
import { createGtPayloadDiagnostic } from '../diagnostics';
import type { RunProgress } from '../runs';
import { followRun, startRun, type Scope } from './api';
import type { LocaleOption } from '../locales';
import { localeNames } from './locales';

const documents = (count: number) =>
  count === 1 ? 'one document' : `${count} documents`;

// The API's message names the billing stop; the hint says where to fix it.
const billingHints: Partial<Record<string, string>> = {
  usage_limit_reached:
    'Upgrade your plan in the General Translation dashboard to keep translating.',
  spend_limit_reached:
    'Raise your spend limit in the General Translation dashboard to keep translating.',
  credits_insufficient:
    'Add credits in the General Translation dashboard to keep translating.',
} satisfies Partial<
  Record<NonNullable<TranslateFilesErrors[402]['code']>, string>
>;
const defaultBillingHint =
  'Check your billing in the General Translation dashboard to keep translating.';

// Only a failure that may clear, or one that never reached the plugin, is worth trying again.
const retryAdvice = (error: unknown) =>
  isTransientApiError(error) || !(error instanceof ApiError)
    ? ' Try again.'
    : ' Check the browser console for details.';

// Starts and follows translation and save runs, and reports the outcome.
export function useTranslate(options: LocaleOption[], onDone?: () => void) {
  const [progress, setProgress] = useState<RunProgress | 'starting' | null>(
    null
  );

  const follow = async (
    route: string,
    start: () => Promise<RunProgress>,
    report: (run: RunProgress) => void,
    failure: string
  ) => {
    setProgress('starting');
    try {
      const started = await start();
      report(await followRun(route, started, setProgress));
    } catch (error) {
      console.error(
        createGtPayloadDiagnostic({
          severity: 'Error',
          whatHappened: failure,
          details: formatDiagnosticErrorDetails(error),
        })
      );
      // Trying again does not help when the user may not edit the document.
      toast.error(
        // Payload's own refusal has no code; a 403 relayed from GT has one.
        error instanceof ApiError && error.status === 403 && !error.code
          ? "You don't have permission to edit this document."
          : failure + retryAdvice(error)
      );
    } finally {
      setProgress(null);
      onDone?.();
    }
  };

  const run = (
    route: string,
    scope: Scope,
    locales: string[],
    saveLocalEdits: boolean
  ) =>
    follow(
      route,
      () => startRun(route, 'translate', scope, { locales, saveLocalEdits }),
      (done) => {
        if (done.billingMessage !== null)
          toast.error(
            `${done.billingMessage.replace(/([^.!?])$/, '$1.')} ${billingHints[done.billingCode ?? ''] ?? defaultBillingHint}`
          );
        else if (done.failedLocales.length)
          toast.error(
            `Couldn't translate into ${localeNames(done.failedLocales, options)}. Try again.`
          );
        else if (done.failedDocuments)
          toast.error(
            `Couldn't translate ${documents(done.failedDocuments)}. Try again.`
          );
        else if (done.skippedStrings)
          toast.warning(
            `Translated into ${localeNames(locales, options)}, but some text was left as it was.`
          );
        else toast.success(`Translated into ${localeNames(locales, options)}.`);
      },
      "Couldn't translate."
    );

  const save = (route: string, scope: Scope, locales: string[]) =>
    follow(
      route,
      () => startRun(route, 'save', scope, { locales }),
      (done) => {
        if (done.failedLocales.length || done.failedDocuments)
          toast.error("Couldn't save all your edits. Try again.");
        else if (done.skippedStrings)
          toast.warning(
            'Your edits are saved, except text whose links you changed. Keep the original links to save it.'
          );
        else toast.success('Your edits are saved.');
      },
      "Couldn't save your edits."
    );

  return { progress, busy: progress !== null, run, save };
}

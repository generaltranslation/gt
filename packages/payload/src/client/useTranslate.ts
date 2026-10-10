import { toast } from '@payloadcms/ui';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { useState } from 'react';
import { createGtPayloadDiagnostic } from '../diagnostics';
import type { RunProgress } from '../runs';
import { followRun, startRun, type Scope } from './api';
import { localeNames, type LocaleOption } from './locales';

const documents = (count: number) =>
  count === 1 ? 'one document' : `${count} documents`;

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
      toast.error(failure);
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
        if (done.usageLimitReached)
          toast.error(
            "You've reached your plan's translation limit. Upgrade your plan in the General Translation dashboard to keep translating."
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
      "Couldn't translate. Try again."
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
      "Couldn't save your edits. Try again."
    );

  return { progress, busy: progress !== null, run, save };
}

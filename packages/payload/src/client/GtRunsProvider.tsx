'use client';
import { useAuth, useConfig } from '@payloadcms/ui';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import React, { useEffect } from 'react';
import { createGtPayloadDiagnostic } from '../diagnostics';
import { apiRoute, followRun, staleRuns } from './api';

// How often an open admin page looks for runs nobody is stepping.
const CHECK_MS = 30_000;

// Picks up translation runs nobody is stepping, such as one whose tab was
// closed, while someone is signed in to the admin panel.
export function GtRunsProvider({ children }: { children?: React.ReactNode }) {
  const { config } = useConfig();
  const { user } = useAuth();
  const route = apiRoute(config);
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    const following = new Set<string | number>();
    const resume = () =>
      staleRuns(route)
        .then((runs) =>
          Promise.all(
            runs
              .filter((run) => !following.has(run.id))
              .map(async (run) => {
                following.add(run.id);
                try {
                  await followRun(route, run, () => undefined);
                } finally {
                  following.delete(run.id);
                }
              })
          )
        )
        .catch((error: unknown) =>
          console.warn(
            createGtPayloadDiagnostic({
              severity: 'Warning',
              whatHappened: 'Could not resume unfinished translations',
              reassurance: 'This page tries again shortly',
              details: formatDiagnosticErrorDetails(error),
            })
          )
        );
    void resume();
    const timer = setInterval(() => void resume(), CHECK_MS);
    return () => clearInterval(timer);
  }, [route, signedIn]);
  return <>{children}</>;
}

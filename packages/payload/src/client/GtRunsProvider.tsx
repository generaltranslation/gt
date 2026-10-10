'use client';
import { useAuth, useConfig } from '@payloadcms/ui';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import React, { useEffect } from 'react';
import { createGtPayloadDiagnostic } from '../diagnostics';
import { apiRoute, followRun, staleRuns } from './api';

// Picks up translation runs nobody is stepping, such as one whose tab was
// closed, whenever someone is signed in to the admin panel.
export function GtRunsProvider({ children }: { children?: React.ReactNode }) {
  const { config } = useConfig();
  const { user } = useAuth();
  const route = apiRoute(config);
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void staleRuns(route)
      .then((runs) =>
        Promise.all(
          runs.map((run) => active && followRun(route, run, () => undefined))
        )
      )
      .catch((error: unknown) =>
        console.warn(
          createGtPayloadDiagnostic({
            severity: 'Warning',
            whatHappened: 'Could not resume unfinished translations',
            reassurance: 'They resume the next time an admin page opens',
            details: formatDiagnosticErrorDetails(error),
          })
        )
      );
    return () => {
      active = false;
    };
  }, [route, signedIn]);
  return <>{children}</>;
}

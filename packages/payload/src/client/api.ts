// Calls to the plugin's endpoints from the admin panel.
import type { ClientConfig } from 'payload';
import type { CoveragePage } from '../coverage';
import type { RunKind, RunProgress, StepResult } from '../runs';
import type { TranslateTarget } from '../types';

export type Scope = { targets: TranslateTarget[] } | { site: true };

// How long to wait before stepping again when the last step had nothing to do.
const WAIT_MS = 3000;

export function apiRoute(config: ClientConfig): string {
  return `${config.serverURL ?? ''}${config.routes.api}`;
}

async function post<T>(route: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${route}/gt${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? response.statusText);
  return json;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startRun(
  route: string,
  kind: RunKind,
  scope: Scope,
  options: { locales: string[]; saveLocalEdits?: boolean }
) {
  return post<RunProgress>(route, '/runs', { kind, ...scope, ...options });
}

// Steps a run until it is done. The run keeps going on the server if this
// stops, for example when the tab closes.
export async function followRun(
  route: string,
  run: RunProgress,
  onProgress: (progress: RunProgress) => void
): Promise<RunProgress> {
  let progress = run;
  onProgress(progress);
  while (progress.status !== 'done') {
    const step = await post<StepResult>(route, '/runs/step', {
      id: progress.id,
    });
    progress = step.progress;
    onProgress(progress);
    if (!step.progressed && progress.status !== 'done') await wait(WAIT_MS);
  }
  return progress;
}

// Running runs nobody has stepped recently.
export function staleRuns(route: string) {
  return post<RunProgress[]>(route, '/runs/stale', {});
}

// One page of the site with each language's coverage.
export function coverage(route: string, page: number, limit: number) {
  return post<CoveragePage>(route, '/coverage', { page, limit });
}

export function progressLabel(progress: RunProgress | 'starting'): string {
  const verb =
    progress !== 'starting' && progress.kind === 'save'
      ? 'Saving'
      : 'Translating';
  if (progress === 'starting' || progress.total <= 1) return `${verb}…`;
  return `${verb}… ${progress.done}/${progress.total}`;
}

import { useSyncExternalStore } from 'react';
import { formatBytes } from './format.ts';
import { navigate } from './router.ts';
import { Shell } from './Shell.tsx';
import type { ExampleSummary } from '../shared/types.ts';

// The example list is static for the lifetime of the server, so it is
// fetched once and shared.
let examples: ExampleSummary[] | null = null;
let failed = false;
const listeners = new Set<() => void>();
let request: Promise<void> | null = null;

function load() {
  request ??= fetch('/api/examples')
    .then((response) => response.json() as Promise<ExampleSummary[]>)
    .then((list) => {
      examples = list;
    })
    .catch(() => {
      failed = true;
      request = null;
    })
    .finally(() => {
      for (const listener of listeners) listener();
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => {
    listeners.delete(listener);
    // Refetch on the next visit so measured sizes stay current.
    if (listeners.size === 0) request = null;
  };
}

function getSnapshot() {
  return failed ? ('failed' as const) : examples;
}

function useExamples() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function Home() {
  const list = useExamples();

  return (
    <Shell
      // The empty sidebar keeps its rail aligned with the analysis page.
      sidebar={null}
    >
      <div className='home'>
        {list === 'failed' && (
          <p className='empty gt-label'>The analysis server did not respond.</p>
        )}
        {Array.isArray(list) &&
          list.map((example) => (
            <a
              key={example.id}
              className='example-card'
              href={`/${example.id}`}
              data-testid={`example-${example.id}`}
              onClick={(event) => {
                event.preventDefault();
                navigate(`/${example.id}`);
              }}
            >
              <div className='example-preview'>
                {example.hasPreview && (
                  <img
                    src={`/previews/${example.id}.png`}
                    alt=''
                    loading='lazy'
                  />
                )}
              </div>
              <div className='example-body'>
                <h2>{example.title}</h2>
                <span className='pkg gt-mono'>{example.pkg}</span>
                {example.lastClientBytes !== null && (
                  <span className='example-size'>
                    {formatBytes(example.lastClientBytes)}
                    <span className='gt-label'>
                      {' '}
                      client, {formatBytes(example.lastClientGtBytes ?? 0)} GT
                    </span>
                  </span>
                )}
              </div>
            </a>
          ))}
      </div>
    </Shell>
  );
}

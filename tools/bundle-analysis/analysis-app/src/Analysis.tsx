import { useMemo, useState } from 'react';
import {
  formatBytes,
  formatDelta,
  formatPercent,
  formatTime,
} from './format.ts';
import { SearchIcon, Shell } from './Shell.tsx';
import { applyState, useExampleState } from './stream.ts';
import { buildTree, findNode, matchesQuery, type TreeNode } from './tree.ts';
import { Treemap } from './Treemap.tsx';
import { gtBytes } from '../shared/summary.ts';
import type {
  BuildSettings,
  BundleKind,
  ExampleState,
} from '../shared/types.ts';

const BUNDLE_LABELS: Record<BundleKind, string> = {
  client: 'Client',
  server: 'Server',
  edge: 'Edge',
};

export function Analysis({ id }: { id: string }) {
  const { state, connected } = useExampleState(id);
  const [kind, setKind] = useState<BundleKind>('client');
  const [zoom, setZoom] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const report = state?.current?.bundles[kind] ?? null;
  const previousReport = state?.previous?.bundles[kind] ?? null;

  const tree = useMemo(
    () =>
      report
        ? buildTree(report.modules, previousReport?.modules ?? null)
        : null,
    [report, previousReport]
  );
  const view = (tree && zoom && findNode(tree, zoom)) || tree;
  const matchCount = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!tree || !search) return null;
    const count = (node: TreeNode): number =>
      node.children.length === 0
        ? Number(matchesQuery(node, search))
        : node.children.reduce((sum, child) => sum + count(child), 0);
    return count(tree);
  }, [tree, query]);

  const changeSettings = async (settings: BuildSettings) => {
    if (state) applyState({ ...state, settings });
    const response = await fetch(`/api/examples/${id}/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (response.ok) applyState((await response.json()) as ExampleState);
  };

  const closeSearch = () => {
    setQuery('');
    setSearchOpen(false);
  };

  return (
    <Shell
      crumb={state?.title ?? id}
      navEnd={
        <div className='search'>
          {searchOpen && (
            <input
              autoFocus
              type='search'
              placeholder='Search files'
              value={query}
              aria-label='Search files in bundle'
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeSearch();
              }}
            />
          )}
          {matchCount !== null && (
            <span className='gt-label search-count'>
              {matchCount} {matchCount === 1 ? 'file' : 'files'}
            </span>
          )}
          <button
            type='button'
            className='icon-button'
            aria-label='Search files in bundle'
            aria-pressed={searchOpen}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            <SearchIcon />
          </button>
        </div>
      }
      sidebar={
        <Sidebar
          state={state}
          kind={kind}
          onSelect={(next) => {
            setKind(next);
            setZoom('');
          }}
          onSettings={changeSettings}
        />
      }
    >
      <div className='analysis'>
        <div className='status-row'>
          <Crumbs kind={kind} zoom={zoom} tree={tree} onZoom={setZoom} />
          <StatusText state={state} connected={connected} />
          <span
            className={`progress ${state?.status.state === 'building' ? 'active' : ''}`}
            aria-hidden='true'
          />
        </div>
        <Stage
          state={state}
          view={view}
          totalBytes={report?.totalBytes ?? 0}
          query={query}
          onZoom={setZoom}
        />
      </div>
    </Shell>
  );
}

/** The treemap path. Only shown once the view is zoomed in. */
function Crumbs({
  kind,
  zoom,
  tree,
  onZoom,
}: {
  kind: BundleKind;
  zoom: string;
  tree: TreeNode | null;
  onZoom: (key: string) => void;
}) {
  if (!zoom) return <span className='crumbs' />;
  return (
    <div className='crumbs' aria-label='Treemap path'>
      <button type='button' onClick={() => onZoom('')}>
        {BUNDLE_LABELS[kind]}
      </button>
      {zoom.split('/').map((segment, index, all) => {
        const key = all.slice(0, index + 1).join('/');
        const exists = tree ? findNode(tree, key)?.key === key : false;
        return (
          <span key={key} className='crumb'>
            <span aria-hidden='true'>/</span>
            <button
              type='button'
              onClick={() => onZoom(key)}
              disabled={!exists || key === zoom}
            >
              {segment}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function StatusText({
  state,
  connected,
}: {
  state: ExampleState | null;
  connected: boolean;
}) {
  const building = state?.status.state === 'building';
  let text = 'Waiting for the first build';
  if (!connected) text = 'Disconnected';
  else if (state?.status.state === 'building') {
    text = `Building. ${state.status.reason}.`;
  } else if (state?.status.state === 'error') text = 'Build failed';
  else if (state?.current)
    text = `Built at ${formatTime(state.current.builtAt)}`;
  return (
    <span
      className='status-text gt-label'
      aria-live='polite'
      data-built-at={building ? '' : (state?.current?.builtAt ?? '')}
    >
      {text}
    </span>
  );
}

function Stage({
  state,
  view,
  totalBytes,
  query,
  onZoom,
}: {
  state: ExampleState | null;
  view: TreeNode | null;
  totalBytes: number;
  query: string;
  onZoom: (key: string) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [observer] = useState(
    () =>
      new ResizeObserver(([entry]) => {
        if (!entry) return;
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      })
  );
  const measure = (element: HTMLDivElement | null) => {
    if (!element) return;
    observer.observe(element);
    return () => observer.unobserve(element);
  };

  const status = state?.status;
  const failed = status?.state === 'error';
  const waiting = !state || (!state.current && !failed);

  return (
    <div className='stage' ref={measure}>
      {failed && (
        <div className='build-error' role='alert'>
          <p className='error-title'>{status.message}</p>
          <pre className='gt-mono'>
            {status.log.trim().split('\n').slice(-40).join('\n')}
          </pre>
        </div>
      )}
      {waiting && <p className='empty gt-label'>Building</p>}
      {view && !failed && (
        <Treemap
          root={view}
          totalBytes={totalBytes}
          width={size.width}
          height={size.height}
          query={query}
          onZoom={onZoom}
        />
      )}
    </div>
  );
}

function Sidebar({
  state,
  kind,
  onSelect,
  onSettings,
}: {
  state: ExampleState | null;
  kind: BundleKind;
  onSelect: (kind: BundleKind) => void;
  onSettings: (settings: BuildSettings) => void;
}) {
  const settings = state?.settings ?? { minify: true, treeShake: true };
  const bundles = state?.current?.bundles ?? {};
  const previous = state?.previous?.bundles ?? {};

  return (
    <>
      <div className='sidebar-section'>
        <div className='bundle-list' role='radiogroup' aria-label='Bundle'>
          {(state?.bundles ?? []).map((bundleKind) => {
            const report = bundles[bundleKind];
            const before = previous[bundleKind];
            const delta =
              report && before
                ? formatDelta(report.totalBytes - before.totalBytes)
                : null;
            const gt = report ? gtBytes(report) : 0;
            const gtDelta =
              report && before ? formatDelta(gt - gtBytes(before)) : null;
            return (
              <button
                key={bundleKind}
                type='button'
                role='radio'
                aria-checked={kind === bundleKind}
                className={`bundle-option ${kind === bundleKind ? 'selected' : ''}`}
                disabled={!report}
                onClick={() => onSelect(bundleKind)}
                data-testid={`bundle-${bundleKind}`}
              >
                <span className='bundle-line'>
                  <span className='bundle-name'>
                    {BUNDLE_LABELS[bundleKind]}
                  </span>
                  <span className='bundle-size'>
                    {report ? formatBytes(report.totalBytes) : ''}
                  </span>
                  {delta && (
                    <span className='delta' data-testid={`delta-${bundleKind}`}>
                      {delta}
                    </span>
                  )}
                </span>
                {report && (
                  <span
                    className='bundle-line bundle-gt'
                    data-testid={`gt-${bundleKind}`}
                  >
                    <span className='bundle-name'>
                      <span className='swatch gt' aria-hidden='true' />
                      GT
                      <span className='gt-label'>
                        {formatPercent(gt, report.totalBytes)}
                      </span>
                    </span>
                    <span className='bundle-size'>{formatBytes(gt)}</span>
                    {gtDelta && <span className='delta'>{gtDelta}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className='sidebar-section'>
        <label className='setting'>
          <input
            type='checkbox'
            checked={settings.minify}
            disabled={!state}
            onChange={(event) =>
              onSettings({ ...settings, minify: event.target.checked })
            }
          />
          <span>Minification</span>
        </label>
        <label className='setting'>
          <input
            type='checkbox'
            checked={settings.treeShake}
            disabled={!state}
            onChange={(event) =>
              onSettings({ ...settings, treeShake: event.target.checked })
            }
          />
          <span>Tree shaking</span>
        </label>
      </div>
    </>
  );
}

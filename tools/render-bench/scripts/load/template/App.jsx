import { Suspense, useSyncExternalStore } from 'react';
import { routes } from '@source/routes.js';
import { Shell } from '@source/Shell.jsx';

const values = { name: 'Ada', count: 3, role: 'admin' };
const landing = Object.keys(routes)[0];

// A route is its layouts and its page, outermost first. The router loads
// them at once, and shows a route when it has them: the page before it stays
// until then, as it does in a router that awaits lazy routes. No component
// here suspends, since React holds back what follows a fallback for 300 ms.
const loading = new Map();
const loaded = new Map();
const listeners = new Set();
let shown;

const currentPath = () =>
  Object.hasOwn(routes, window.location.pathname)
    ? window.location.pathname
    : landing;

function show(path) {
  if (!loading.has(path)) {
    loading.set(
      path,
      Promise.all(routes[path].map((load) => load())).then((modules) => {
        loaded.set(path, modules);
      })
    );
  }
  void loading.get(path).then(() => {
    if (currentPath() !== path) return;
    shown = path;
    for (const notify of listeners) notify();
  });
}

function subscribe(notify) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

window.addEventListener('popstate', () => show(currentPath()));

export function preloadRoute() {
  show(currentPath());
}

export function App() {
  const path = useSyncExternalStore(subscribe, () => shown);
  return (
    <Shell {...values}>
      {/* For a build whose translations suspend; nothing else here does. */}
      <Suspense fallback={null}>
        {path !== undefined && (
          <main data-bench-route={path}>
            {loaded.get(path).reduceRight(
              (children, { Route }) => (
                <Route {...values}>{children}</Route>
              ),
              null
            )}
          </main>
        )}
      </Suspense>
    </Shell>
  );
}

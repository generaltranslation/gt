import { useSyncExternalStore, type MouseEvent } from 'react';

// A minimal history router, so the app needs no router dependency.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function navigate(path: string) {
  window.history.pushState(null, '', path);
  for (const listener of listeners) listener();
}

export function onLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
    return;
  }
  event.preventDefault();
  navigate(event.currentTarget.pathname);
}

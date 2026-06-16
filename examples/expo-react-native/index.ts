import { registerRootComponent } from 'expo';
import {
  createElement,
  useSyncExternalStore,
  type ComponentType,
} from 'react';

import { reloadRuntime } from './runtimeReload';
import { setupGT } from './setupGT';

let Main: ComponentType | null = null;
const listeners = new Set<() => void>();

function Root() {
  const Component = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!Component) return null;
  return createElement(Component);
}

registerRootComponent(Root);

void bootstrap();

async function bootstrap() {
  await setupGT(reloadRuntime);
  Main = (await import('./main')).default;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return Main;
}

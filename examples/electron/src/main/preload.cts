// A sandboxed preload script has to be CommonJS, which is why this file is .cts.
import { contextBridge, ipcRenderer } from 'electron';
import type { LocaleBridge } from '../gt.d.ts';

// Read once, synchronously, so the page knows its locale before it renders.
let locale: string = ipcRenderer.sendSync('gt:get-locale');
const listeners = new Set<() => void>();

ipcRenderer.on('gt:locale-changed', (_event, nextLocale: string) => {
  locale = nextLocale;
  listeners.forEach((listener) => listener());
});

const bridge: LocaleBridge = {
  getLocale: () => locale,
  setLocale: (nextLocale) => ipcRenderer.invoke('gt:set-locale', nextLocale),
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

contextBridge.exposeInMainWorld('gt', bridge);

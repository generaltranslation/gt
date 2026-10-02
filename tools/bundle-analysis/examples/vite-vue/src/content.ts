import { msg, t } from 'gt-vue';

// Module-level strings. t() resolves immediately because index.ts awaits
// initializeGTSPA() before importing the application graph.
export const footerNote = t(
  'Quire is a fictional product. This page is a gt-vue example.'
);

export const specs = [
  { value: 200, unit: 'ms', label: msg('Median sync time between devices') },
  { value: 3, unit: '', label: msg('Devices included with every seat') },
  {
    value: 256,
    unit: 'bit',
    label: msg('AES keys that never leave your devices'),
  },
  { value: 14, unit: '', label: msg('Days of free trial, no card required') },
];

export const files = [
  { name: 'inbox.md', bytes: 2048 },
  { name: 'meetings/2026-10-01.md', bytes: 6912 },
  { name: 'meetings/2026-10-02.md', bytes: 4310 },
  { name: 'reading-list.md', bytes: 15360 },
  { name: 'ideas.md', bytes: 896 },
];

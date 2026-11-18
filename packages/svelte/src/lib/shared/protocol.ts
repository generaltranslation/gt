/** Package specifier that compiled output imports its runtime helpers from. */
export const packageName = 'gt-svelte';

/** Every identifier the plugin generates starts with this reserved prefix. */
export const compiledPrefix = '__gt_';

export const hashProp = `${compiledPrefix}hash`;
export const sourceProp = `${compiledPrefix}source`;
export const componentHandle = `${compiledPrefix}rt`;
export const handleAlias = `${compiledPrefix}handle`;
export const lookupAlias = `${compiledPrefix}lookup`;
export const renderParam = `${compiledPrefix}r`;
export const childrenParam = `${compiledPrefix}c`;
export const textParam = `${compiledPrefix}t`;

/** Names the snippet that renders the element or variable with this id. */
export function snippetName(id: number): string {
  return `${compiledPrefix}${id}`;
}

/** Runtime exports whose uses the plugin compiles. */
export const trackedExports = [
  'gt',
  'T',
  'Var',
  'Num',
  'Currency',
  'DateTime',
] as const;

export type TrackedExport = (typeof trackedExports)[number];

export const variableExports = {
  Var: { name: 'value', type: 'v' },
  Num: { name: 'n', type: 'n' },
  Currency: { name: 'cost', type: 'c' },
  DateTime: { name: 'date', type: 'd' },
} as const;

export type VariableExport = keyof typeof variableExports;

export function isTrackedExport(name: string): name is TrackedExport {
  return (trackedExports as readonly string[]).includes(name);
}

export function isVariableExport(name: string): name is VariableExport {
  return Object.hasOwn(variableExports, name);
}

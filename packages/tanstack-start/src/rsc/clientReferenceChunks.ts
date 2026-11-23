// How TanStack Start marks a server component with the client chunks its
// payload names: on the server, by the time the loader that rendered it
// returns. The framework sends the same list to the browser with the payload.
const CLIENT_CHUNKS = Symbol.for('tanstack.rsc.jsPreloads');

function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof (value as Iterable<unknown>)?.[Symbol.iterator] === 'function';
}

/**
 * The URLs of the client chunks that the server components in a route's
 * loader data name: the modules of the client components they render, which
 * the browser imports before it hydrates them. Empty when the data holds no
 * server component, or one whose chunks the framework does not say.
 */
export function findClientReferenceChunks(loaderData: unknown): string[] {
  const chunks = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (value: unknown): void => {
    if ((typeof value !== 'object' && typeof value !== 'function') || !value) {
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    // A server component answers any property, so it is read and not walked
    if (CLIENT_CHUNKS in value) {
      const named = (value as { [CLIENT_CHUNKS]: unknown })[CLIENT_CHUNKS];
      for (const url of isIterable(named) ? named : []) {
        if (typeof url === 'string') chunks.add(url);
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach(visit);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      Object.values(value).forEach(visit);
    }
  };
  visit(loaderData);
  return [...chunks];
}

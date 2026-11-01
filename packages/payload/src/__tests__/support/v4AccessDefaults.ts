import type { Payload } from 'payload';

// Exercise the real v3 database and access rules with v4's opt-in bypass.
// A proxy keeps fixture setup on the original Payload instance unaffected.
export function withV4AccessDefaults(payload: Payload): Payload {
  const operations = new Set([
    'create',
    'find',
    'findByID',
    'update',
    'delete',
    'count',
    'findGlobal',
    'updateGlobal',
  ]);
  const jobs = new Proxy(payload.jobs, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (key === 'queue')
        return (args: Record<string, unknown>) =>
          Reflect.apply(value, target, [
            { ...args, overrideAccess: args.overrideAccess ?? false },
          ]);
      return value;
    },
  });
  return new Proxy(payload, {
    get(target, key) {
      if (key === 'jobs') return jobs;
      const value = Reflect.get(target, key);
      if (operations.has(String(key)))
        return (args: Record<string, unknown>) =>
          Reflect.apply(value, target, [
            { ...args, overrideAccess: args.overrideAccess ?? false },
          ]);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

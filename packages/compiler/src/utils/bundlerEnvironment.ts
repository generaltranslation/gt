/**
 * The parts of Vite's per-environment plugin context (`this.environment`,
 * Vite 6+) the compiler reads. Unplugin's context types don't expose it.
 */
export type BundlerEnvironment = {
  name?: string;
  mode?: string;
  config?: { consumer?: string };
};

/** Reads `this.environment` from a transform/build hook context, if any. */
export function getBundlerEnvironment(
  context: unknown
): BundlerEnvironment | undefined {
  return (context as { environment?: BundlerEnvironment } | undefined)
    ?.environment;
}

/**
 * Whether a module is being transformed for a client production build:
 * Vite's environment (`consumer === 'client'` and `mode === 'build'`) when
 * present, otherwise the legacy `ssr` transform flag plus the resolved Vite
 * command. Other bundlers (no environment, no Vite command) never qualify.
 */
export function isClientProductionBuild({
  environment,
  ssr,
  command,
}: {
  environment?: BundlerEnvironment;
  ssr?: boolean;
  command?: string;
}): boolean {
  const consumer = environment?.config?.consumer;
  if (consumer) return consumer === 'client' && environment?.mode === 'build';
  return command === 'build' && !ssr;
}

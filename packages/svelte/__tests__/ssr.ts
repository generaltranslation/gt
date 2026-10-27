import { join } from 'node:path';
import type { Component } from 'svelte';
import type { ViteDevServer } from 'vite';
import { vi } from 'vitest';
import { gtPreprocess } from '../src/preprocess';

export type ServerRenderer = {
  /** Server-renders a fixture inside `Harness.svelte`. */
  render: (fixture: string, props: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
};

/**
 * Starts a Vite server that compiles fixtures for the server, so browser
 * tests can hydrate a real server render.
 */
export async function createServerRenderer(): Promise<ServerRenderer> {
  // esbuild expects encoded text to be an instance of the global Uint8Array.
  const { TextEncoder: NodeTextEncoder } = await import('node:util');
  vi.stubGlobal(
    'TextEncoder',
    class extends NodeTextEncoder {
      encode(input?: string) {
        const bytes = super.encode(input);
        return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      }
    }
  );
  const { createServer } = await import('vite');
  const { svelte } = await import('@sveltejs/vite-plugin-svelte');
  const server: ViteDevServer = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [svelte({ preprocess: [gtPreprocess()] })],
    resolve: {
      alias: { 'gt-svelte': join(process.cwd(), 'src/index.ts') },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
  });
  const load = async (path: string) =>
    ((await server.ssrLoadModule(path)) as { default: Component }).default;
  const [{ render }, harness] = await Promise.all([
    server.ssrLoadModule('svelte/server'),
    load('/__tests__/fixtures/Harness.svelte'),
  ]);
  return {
    render: async (fixture, props) =>
      render(harness, {
        props: {
          component: await load(`/__tests__/fixtures/${fixture}`),
          ...props,
        },
      }).body,
    close: async () => {
      await server.close();
      vi.unstubAllGlobals();
    },
  };
}

import type { ReactNode } from 'react';
import type { Instance } from 'ink';
import { render } from 'ink';
import { registerTerminalSessionCleanup } from './terminalSession.js';
import type { PromptResult } from './inkTypes.js';

function enterAlternateScreen() {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\x1b[?1049h\x1b[H');
}

function exitAlternateScreen() {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\x1b[?1049l');
}

function unmount(instance: Instance | undefined) {
  if (!instance) return;
  try {
    instance.unmount();
  } catch {
    // Best-effort cleanup; ignore terminal restore failures.
  }
}

export async function runPrompt<T>(
  nodeFactory: (onComplete: (result: PromptResult<T>) => void) => ReactNode
) {
  let instance: Instance | undefined;
  let unregisterCleanup = () => {};

  try {
    return await new Promise<PromptResult<T>>((resolve) => {
      const node = nodeFactory(resolve);
      unregisterCleanup = registerTerminalSessionCleanup(() => {
        unmount(instance);
        instance = undefined;
        exitAlternateScreen();
      });
      enterAlternateScreen();
      instance = render(node);
    });
  } finally {
    unregisterCleanup();
    unmount(instance);
    exitAlternateScreen();
  }
}

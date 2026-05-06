type Cleanup = () => void;

let activeCleanup: Cleanup | undefined;
let processCleanupRegistered = false;

function registerProcessCleanup() {
  if (processCleanupRegistered) return;
  processCleanupRegistered = true;

  process.on('exit', () => {
    endTerminalSession();
  });
  process.on('SIGINT', () => {
    endTerminalSession();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    endTerminalSession();
    process.exit(143);
  });
}

export function registerTerminalSessionCleanup(cleanup: Cleanup) {
  registerProcessCleanup();
  activeCleanup = cleanup;

  return () => {
    if (activeCleanup === cleanup) {
      activeCleanup = undefined;
    }
  };
}

export function endTerminalSession() {
  const cleanup = activeCleanup;
  if (!cleanup) return;
  activeCleanup = undefined;
  cleanup();
}

export function shouldUseInkPrompts() {
  return (
    process.env.GT_INK !== '0' &&
    process.stdin.isTTY === true &&
    process.stdout.isTTY === true
  );
}

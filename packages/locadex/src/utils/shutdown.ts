import { logger } from '../logging/logger.js';

export type ExitCode = 0 | 1;

interface ShutdownHandler {
  name: string;
  handler: () => Promise<void> | void;
  timeout?: number;
}

class GracefulShutdown {
  private shutdownHandlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private exitCode: ExitCode = 0;

  constructor() {
    process.on('SIGINT', () => this.handleSignal('SIGINT'));
    process.on('SIGTERM', () => this.handleSignal('SIGTERM'));
    process.on('SIGUSR2', () => this.handleSignal('SIGUSR2')); // nodemon restart
    process.on('exit', () => this.handleSignal('exit')); // in case other libraries override the signal handlers such as @clack/prompts
  }

  async handleSignal(signal: string) {
    logger.debugMessage(
      `Received ${signal}, initiating graceful shutdown with exit code 0...`
    );
    await this.shutdown(0);
  }

  addHandler(handler: ShutdownHandler) {
    this.shutdownHandlers.push(handler);
  }

  async shutdown(exitCode: ExitCode = 0) {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.exitCode = exitCode;

    // Execute shutdown handlers in reverse order (LIFO)
    const handlers = [...this.shutdownHandlers].reverse();

    for (const { name, handler, timeout = 5000 } of handlers) {
      try {
        logger.debugMessage(`Executing shutdown handler: ${name}`);

        const timeoutPromise = new Promise<void>((_, reject) => {
          global.setTimeout(
            () => reject(new Error(`Timeout: ${name}`)),
            timeout
          );
        });

        await Promise.race([Promise.resolve(handler()), timeoutPromise]);

        logger.debugMessage(`Completed shutdown handler: ${name}`);
      } catch (error) {
        logger.error(`Error in shutdown handler ${name}: ${error}`);
      }
    }

    logger.debugMessage('Graceful shutdown complete');
    process.exit(this.exitCode);
  }
}

// Export singleton instance
export const gracefulShutdown = new GracefulShutdown();

// Export convenience function for backward compatibility
export function exit(code: ExitCode = 0): Promise<never> {
  return gracefulShutdown.shutdown(code) as Promise<never>;
}

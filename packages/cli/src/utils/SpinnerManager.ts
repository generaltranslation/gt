import chalk from 'chalk';
import { createSpinner } from '../console/logging.js';

/**
 * Centralized spinner management for tracking multiple async operations
 */
export class SpinnerManager {
  private spinners = new Map<string, ReturnType<typeof createSpinner>>();

  /**
   * Run an async operation with a spinner
   */
  async run<T>(id: string, message: string, fn: () => Promise<T>): Promise<T> {
    const spinner = createSpinner('dots');
    this.spinners.set(id, spinner);
    spinner.start(message);

    try {
      const result = await fn();
      spinner.stop(chalk.green('✓'));
      return result;
    } catch (error) {
      spinner.stop(chalk.red('✗'));
      throw error;
    } finally {
      this.spinners.delete(id);
    }
  }

  /**
   * Mark a spinner as successful
   */
  succeed(id: string, message: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.stop(chalk.green(message));
      this.spinners.delete(id);
    }
  }

  /**
   * Mark a spinner as warning
   */
  warn(id: string, message: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.stop(chalk.yellow(message));
      this.spinners.delete(id);
    }
  }

  /**
   * Start a new spinner
   */
  start(id: string, message: string): void {
    const spinner = createSpinner('dots');
    this.spinners.set(id, spinner);
    spinner.start(message);
  }

  /**
   * Stop a specific spinner
   */
  stop(id: string, message?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.stop(message);
      this.spinners.delete(id);
    }
  }

  /**
   * Stop all running spinners
   */
  stopAll(): void {
    this.spinners.forEach((s) => s.stop());
    this.spinners.clear();
  }
}

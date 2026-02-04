/**
 * Central error collector singleton for collecting errors during command execution.
 * When enabled via --json-errors flag, errors are collected and output as JSON at the end.
 */
class ErrorCollector {
  private static instance: ErrorCollector;
  private errors: string[] = [];
  private enabled: boolean = false;

  private constructor() {}

  static getInstance(): ErrorCollector {
    if (!ErrorCollector.instance) {
      ErrorCollector.instance = new ErrorCollector();
    }
    return ErrorCollector.instance;
  }

  enable(): void {
    this.enabled = true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  addError(message: string): void {
    if (this.enabled) {
      this.errors.push(message);
    }
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  clear(): void {
    this.errors = [];
  }

  toJSON(): string {
    return JSON.stringify({ errors: this.errors });
  }
}

export const errorCollector = ErrorCollector.getInstance();

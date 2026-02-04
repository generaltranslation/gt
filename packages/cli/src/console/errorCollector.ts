/**
 * Central error collector singleton for collecting errors during command execution.
 * When enabled via --json-errors flag, errors are collected and output as JSON at the end.
 */

type ErrorEntry = {
  file?: string;
  message: string;
};

class ErrorCollector {
  private static instance: ErrorCollector;
  private errors: ErrorEntry[] = [];
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
    this.errors = []; // Clear any stale errors from previous runs
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // For general errors without file context
  addError(message: string): void {
    if (this.enabled) {
      this.errors.push({ message });
    }
  }

  // For errors with file context
  addFileError(file: string, message: string): void {
    if (this.enabled) {
      this.errors.push({ file, message });
    }
  }

  getErrors(): ErrorEntry[] {
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

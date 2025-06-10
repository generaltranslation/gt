import { ProgressResult, SpinnerResult } from '@clack/prompts';
import { CliOptions } from '../types/cli.js';
import {
  logInfo,
  logWarning,
  logError,
  logSuccess,
  logStep,
  logMessage,
  logErrorAndExit,
  createProgressBar,
  createSpinner,
} from './console.js';
import { appendFileSync } from 'node:fs';

class ProgressBar {
  private progressBar: ProgressResult | undefined;
  constructor() {}

  init(total: number): void {
    if (!this.progressBar) {
      this.progressBar = createProgressBar(total);
    }
  }

  start(message?: string): void {
    if (this.progressBar) {
      this.progressBar.start(message);
    }
  }

  advance(amount: number, message?: string): void {
    if (this.progressBar) {
      this.progressBar.advance(amount, message);
    }
  }

  stop(message?: string): void {
    if (this.progressBar) {
      try {
        this.progressBar.stop(message);
        this.progressBar = undefined;
      } catch (error) {
        this.progressBar = undefined;
      }
    }
  }
}

class Spinner {
  private spinner: SpinnerResult | undefined;
  constructor() {}

  init(): void {
    if (!this.spinner) {
      this.spinner = createSpinner();
    }
  }

  start(message?: string): void {
    if (this.spinner) {
      this.spinner.start(message);
    }
  }

  update(message?: string): void {
    if (this.spinner) {
      this.spinner.message(message);
    }
  }

  stop(message?: string): void {
    if (this.spinner) {
      try {
        this.spinner.stop(message);
        this.spinner = undefined;
      } catch (error) {
        this.spinner = undefined;
      }
    }
  }
}

class Logger {
  private static instance: Logger;
  private _verbose: boolean = false;
  private _debug: boolean = false;
  private logFile: string | undefined;
  progressBar: ProgressBar = new ProgressBar();
  spinner: Spinner = new Spinner();
  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  initialize(options: CliOptions, logFile?: string): void {
    if (options.debug) {
      this._debug = true;
      this._verbose = true;
    }
    if (options.verbose) {
      this._verbose = true;
    }
    if (logFile) {
      this.logFile = logFile;
    }
  }

  get verbose(): boolean {
    return this._verbose;
  }

  get debug(): boolean {
    return this._debug;
  }

  reset(): void {
    this._verbose = false;
    this._debug = false;
  }

  // Basic logging methods using existing console functions
  info(message: string): void {
    this.log(message);
    logInfo(message);
  }

  warning(message: string): void {
    this.log(message);
    logWarning(message);
  }

  error(message: string): void {
    this.log(message);
    logError(message);
  }

  success(message: string): void {
    this.log(message);
    logSuccess(message);
  }

  step(message: string): void {
    this.log(message);
    logStep(message);
  }

  message(message: string): void {
    this.log(message);
    logMessage(message);
  }

  async errorAndExit(message: string) {
    this.log(message);
    await logErrorAndExit(message);
  }

  // Conditional logging methods
  verboseMessage(message: string): void {
    this.log(message);
    if (this._verbose) {
      logMessage(message);
    }
  }

  debugMessage(message: string): void {
    this.log(message);
    if (this._debug) {
      logMessage(message);
    }
  }

  log(message: string): void {
    if (this.logFile) {
      const timestamp = new Date().toISOString();
      appendFileSync(this.logFile, `[${timestamp}] ${message}\n`);
    }
  }

  initializeProgressBar(total: number): void {
    if (!this._verbose && !this._debug) {
      this.progressBar.init(total);
    }
    if (this.logFile) {
      appendFileSync(
        this.logFile,
        `Initializing progress bar with total: ${total}\n`
      );
    }
  }
  initializeSpinner(): void {
    if (!this._verbose && !this._debug) {
      this.spinner.init();
    }
    if (this.logFile) {
      appendFileSync(this.logFile, `Initializing spinner\n`);
    }
  }
}

export const logger = Logger.getInstance();

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
    logInfo(message);
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  warning(message: string): void {
    logWarning(message);
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  error(message: string): void {
    logError(message);
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  success(message: string): void {
    logSuccess(message);
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  step(message: string): void {
    logStep(message);
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  message(message: string): void {
    logMessage(message);
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  errorAndExit(message: string): void {
    logErrorAndExit(message);
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  // Conditional logging methods
  verboseMessage(message: string): void {
    if (this._verbose) {
      logMessage(message);
    }
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  debugMessage(message: string): void {
    if (this._debug) {
      logMessage(message);
    }
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
    }
  }

  log(message: string): void {
    if (this.logFile) {
      appendFileSync(this.logFile, `${message}\n`);
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

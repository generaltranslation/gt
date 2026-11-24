/** What the preload script exposes to the page as `window.gt`. */
export interface LocaleBridge {
  getLocale(): string;
  /** Asks the main process to change the locale of the whole app. */
  setLocale(locale: string): Promise<void>;
  /** Runs `listener` after each locale change. Returns a function that stops the calls. */
  subscribe(listener: () => void): () => void;
}

declare global {
  interface Window {
    gt: LocaleBridge;
  }
}

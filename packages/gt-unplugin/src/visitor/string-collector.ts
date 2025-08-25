/**
 * String Collector - Manages translation content across two-pass transformation
 *
 * Pass 1: Collects translation strings, JSX content, and hash data
 * Pass 2: Injects collected data back into useGT()/getGT() calls
 */

/**
 * Content extracted from a t() function call
 */
export interface TranslationContent {
  /** The string message: t("Hello world") → "Hello world" */
  message: string;
  /** Pre-calculated hash for this content */
  hash: string;
  /** Optional ID from options: t("text", {id: "greeting"}) → "greeting" */
  id?: string;
  /** Optional context from options: t("text", {context: "nav"}) → "nav" */
  context?: string;
}

/**
 * Content extracted from JSX translation components like <T>
 */
export interface TranslationJsx {
  /** Pre-calculated hash for this JSX content */
  hash: string;
}

/**
 * Just a hash value for simple hash injection
 */
export interface TranslationHash {
  /** The hash value to inject */
  hash: string;
}

/**
 * Collection of all translation data for a single useGT/getGT call
 */
export interface TranslationData {
  /** Multiple content items from t() function calls */
  content: TranslationContent[];
  /** Single JSX component data (if any) */
  jsx?: TranslationJsx;
  /** Single hash value (if any) */
  hash?: TranslationHash;
}

/**
 * String collector for two-pass transformation system
 */
export class StringCollector {
  /** Vector of translation calls indexed by counter ID */
  private aggregators: TranslationData[] = [];
  /** Global counter incremented for each useGT/getGT call encountered */
  private globalCallCounter: number = 0;

  /**
   * Increment counter and return the current counter ID for a useGT/getGT call
   * These IDs are deterministic, stable, unique, and simple
   */
  incrementCounter(): number {
    this.globalCallCounter += 1;
    return this.globalCallCounter;
  }

  /**
   * Get current global counter value
   */
  getCounter(): number {
    return this.globalCallCounter;
  }

  /**
   * Pass 1: Initialize a useGT/getGT call for later content injection
   */
  initializeAggregator(counterId: number): void {
    // Ensure the array is large enough to hold this index
    while (this.aggregators.length <= counterId) {
      this.aggregators.push({ content: [], jsx: undefined, hash: undefined });
    }
  }

  /**
   * Pass 1: Add translation content from a t() call to a specific useGT/getGT
   * Multiple content items can be added to the same call
   */
  setTranslationContent(counterId: number, content: TranslationContent): void {
    const call = this.aggregators[counterId];
    if (call) {
      call.content.push(content);
    } else {
      console.warn(
        `Warning: Trying to add content to uninitialized call ID: ${counterId}`
      );
    }
  }

  /**
   * Pass 1: Set JSX translation content for a specific useGT/getGT
   * Only one JSX item can be set per call (overwrites if called multiple times)
   */
  setTranslationJsx(counterId: number, jsx: TranslationJsx): void {
    const call = this.aggregators[counterId];
    if (call) {
      call.jsx = jsx;
    } else {
      console.warn(
        `Warning: Trying to set JSX for uninitialized call ID: ${counterId}`
      );
    }
  }

  /**
   * Pass 1: Set hash-only content for a specific useGT/getGT
   * Only one hash can be set per call (overwrites if called multiple times)
   */
  setTranslationHash(counterId: number, hash: TranslationHash): void {
    const call = this.aggregators[counterId];
    if (call) {
      call.hash = hash;
    } else {
      console.warn(
        `Warning: Trying to set hash for uninitialized call ID: ${counterId}`
      );
    }
  }

  /**
   * Pass 2: Get translation call data for injection into a specific useGT/getGT call
   */
  getTranslationData(counterId: number): TranslationData | null {
    return this.aggregators[counterId] || null;
  }

  /**
   * Get the translation JSX for a specific useGT/getGT call
   */
  getTranslationJsx(counterId: number): TranslationJsx | null {
    const data = this.aggregators[counterId];
    return data?.jsx || null;
  }

  /**
   * Get the translation hash for a specific useGT/getGT call
   */
  getTranslationHash(counterId: number): TranslationHash | null {
    const data = this.aggregators[counterId];
    return data?.hash || null;
  }

  /**
   * Pass 2: Check if a call has any content to inject
   */
  hasContentForInjection(counterId: number): boolean {
    const data = this.aggregators[counterId];
    if (!data) return false;

    return (
      data.content.length > 0 ||
      data.jsx !== undefined ||
      data.hash !== undefined
    );
  }

  /**
   * Create an array literal for injection from TranslationContent
   * Ported from Rust: create_content_array (lines 198-214)
   */
  createContentArray(contents: TranslationContent[], span?: any): any[] {
    // Return a structure that can be converted to Babel AST later
    // The span parameter maintains source location information like in Rust
    return contents.map((content) => ({
      message: content.message,
      $_hash: content.hash,
      ...(content.id && { $id: content.id }),
      ...(content.context && { $context: content.context }),
    }));
  }

  /**
   * Helper: Create a TranslationContent from t() call components
   */
  static createTranslationContent(
    message: string,
    hash: string,
    id?: string,
    context?: string
  ): TranslationContent {
    return { message, hash, id, context };
  }

  /**
   * Helper: Create a TranslationJsx from JSX component props
   */
  static createTranslationJsx(hash: string): TranslationJsx {
    return { hash };
  }

  /**
   * Helper: Create a TranslationHash for simple hash injection
   */
  static createTranslationHash(hash: string): TranslationHash {
    return { hash };
  }

  /**
   * Reset all state (useful for testing)
   */
  clear(): void {
    this.aggregators = [];
    this.globalCallCounter = 0;
  }

  /**
   * Reset the counter to zero
   */
  resetCounter(): void {
    this.globalCallCounter = 0;
  }
}

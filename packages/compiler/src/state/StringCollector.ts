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
 * String collector for two-pass transformation system
 */
export class StringCollector {
  /** Vector of translation calls indexed by counter ID */
  private contentAggregators: Map<number, TranslationContent[]> = new Map();
  private jsxAggregators: Map<number, TranslationJsx> = new Map();
  private hashAggregators: Map<number, TranslationHash> = new Map();
  /** Global counter incremented for each useGT/getGT call encountered */
  private globalCallCounter: number = 0;

  /**
   * Increment counter and return the current counter ID for a useGT/getGT call
   * These IDs are deterministic
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
   * Pass 1: Add translation content from a t() call to a specific useGT/getGT
   * Multiple content items can be added to the same call
   */
  setTranslationContent(counterId: number, content: TranslationContent): void {
    if (counterId === -1) {
      throw new Error(
        'Cannot have a counterId of -1. You are likely trying to register content from a namespace method invocation.'
      );
    }
    // Get the agreggator
    let aggregator = this.contentAggregators.get(counterId);
    if (!aggregator) {
      aggregator = [content];
      this.contentAggregators.set(counterId, aggregator);
    } else {
      aggregator.push(content);
    }
  }

  /**
   * Pass 1: Set JSX translation content for a specific useGT/getGT
   * Only one JSX item can be set per call (overwrites if called multiple times)
   */
  setTranslationJsx(counterId: number, jsx: TranslationJsx): void {
    this.jsxAggregators.set(counterId, jsx);
  }

  /**
   * Pass 1: Set hash-only content for a specific useGT/getGT
   * Only one hash can be set per call (overwrites if called multiple times)
   */
  setTranslationHash(counterId: number, hash: TranslationHash): void {
    this.hashAggregators.set(counterId, hash);
  }

  /**
   * Pass 2: Get translation call data for injection into a specific useGT/getGT call
   */
  getTranslationData(counterId: number):
    | {
        type: 'content' | 'jsx' | 'hash';
        value: TranslationContent[] | TranslationJsx | TranslationHash;
      }
    | undefined {
    if (this.contentAggregators.has(counterId)) {
      return {
        type: 'content',
        value: this.contentAggregators.get(counterId)!,
      };
    } else if (this.jsxAggregators.has(counterId)) {
      return { type: 'jsx', value: this.jsxAggregators.get(counterId)! };
    } else if (this.hashAggregators.has(counterId)) {
      return { type: 'hash', value: this.hashAggregators.get(counterId)! };
    }
  }

  /**
   * Get the translation content for a specific useGT/getGT call
   */
  getTranslationContent(counterId: number): TranslationContent[] | undefined {
    return this.contentAggregators.get(counterId);
  }

  /**
   * Get the translation JSX for a specific <T> component
   */
  getTranslationJsx(counterId: number): TranslationJsx | undefined {
    return this.jsxAggregators.get(counterId);
  }

  /**
   * Get the translation hash for a specific other call
   */
  getTranslationHash(counterId: number): TranslationHash | undefined {
    return this.hashAggregators.get(counterId);
  }

  /**
   * Reset all state (useful for testing)
   */
  clear(): void {
    this.contentAggregators.clear();
    this.jsxAggregators.clear();
    this.hashAggregators.clear();
    this.globalCallCounter = 0;
  }

  /**
   * Reset the counter to zero
   */
  resetCounter(): void {
    this.globalCallCounter = 0;
  }

  /**
   * Has content
   */
  hasContent(): boolean {
    return (
      this.contentAggregators.size +
        this.jsxAggregators.size +
        this.hashAggregators.size >
      0
    );
  }

  /**
   * Helper convert to string
   */
  serialize(): any {
    const output = {
      contentAggregators: Object.fromEntries(this.contentAggregators),
      jsxAggregators: Object.fromEntries(this.jsxAggregators),
      hashAggregators: Object.fromEntries(this.hashAggregators),
      globalCallCounter: this.globalCallCounter,
    };
    return output;
  }

  /**
   * Helper to repopulate
   */
  unserialize(input: any): void {
    this.contentAggregators = Object.entries(
      input.contentAggregators as Record<number, TranslationContent[]>
    ).reduce((acc, [key, value]) => {
      acc.set(Number(key), value);
      return acc;
    }, new Map<number, TranslationContent[]>());
    this.jsxAggregators = Object.entries(
      input.jsxAggregators as Record<number, TranslationJsx>
    ).reduce((acc, [key, value]) => {
      acc.set(Number(key), value);
      return acc;
    }, new Map<number, TranslationJsx>());
    this.hashAggregators = Object.entries(
      input.hashAggregators as Record<number, TranslationHash>
    ).reduce((acc, [key, value]) => {
      acc.set(Number(key), value);
      return acc;
    }, new Map<number, TranslationHash>());
    this.globalCallCounter = input.globalCallCounter;
  }
}

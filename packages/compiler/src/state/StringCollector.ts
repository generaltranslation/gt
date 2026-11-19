/**
 * String Collector - Manages translation content across two-pass transformation
 *
 * Pass 1: Collects the JSX content and hash of each <T>
 * Pass 2: Injects the collected hashes back into the <T> calls
 */

/**
 * Content extracted from JSX translation components like <T>
 */
export interface TranslationJsx {
  /** Pre-calculated hash for this JSX content */
  hash: string;
  /** JSX children structure (serializable) */
  children?: unknown;
  /** Optional ID from props */
  id?: string;
  /** Optional context from props */
  context?: string;
  /** Optional requiresReview from props */
  requiresReview?: boolean;
}

type SerializedStringCollector = {
  jsxAggregators: Record<string, TranslationJsx>;
  globalCallCounter: number;
};

/**
 * String collector for two-pass transformation system
 */
export class StringCollector {
  /** JSX translation content indexed by counter ID */
  private jsxAggregators: Map<number, TranslationJsx> = new Map();
  /** Global counter incremented for each <T> encountered */
  private globalCallCounter: number = 0;

  /**
   * Increment counter and return the current counter ID for a <T>
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
   * Pass 1: Set JSX translation content for a specific <T>
   * Only one JSX item can be set per call (overwrites if called multiple times)
   */
  setTranslationJsx(counterId: number, jsx: TranslationJsx): void {
    this.jsxAggregators.set(counterId, jsx);
  }

  /**
   * Get the translation JSX for a specific <T> component
   */
  getTranslationJsx(counterId: number): TranslationJsx | undefined {
    return this.jsxAggregators.get(counterId);
  }

  /**
   * Reset all state (useful for testing)
   */
  clear(): void {
    this.jsxAggregators.clear();
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
    return this.jsxAggregators.size > 0;
  }

  /**
   * Get all translation JSX entries
   */
  getAllTranslationJsx(): TranslationJsx[] {
    return Array.from(this.jsxAggregators.values());
  }

  /**
   * Helper convert to string
   */
  serialize(): SerializedStringCollector {
    const output = {
      jsxAggregators: Object.fromEntries(this.jsxAggregators),
      globalCallCounter: this.globalCallCounter,
    };
    return output;
  }

  /**
   * Helper to repopulate
   */
  unserialize(input: SerializedStringCollector): void {
    this.jsxAggregators = Object.entries(
      input.jsxAggregators as Record<number, TranslationJsx>
    ).reduce((acc, [key, value]) => {
      acc.set(Number(key), value);
      return acc;
    }, new Map<number, TranslationJsx>());
    this.globalCallCounter = input.globalCallCounter;
  }
}

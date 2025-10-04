import crypto from 'crypto';
import { TransformState } from '../../state/types';
/**
 * Variable types matching the TypeScript definition
 */
export enum VariableType {
  Variable = 'v', // Variable
  Number = 'n', // Number
  Date = 'd', // Date
  Currency = 'c', // Currency
}

/**
 * Map of data-_gt properties to their corresponding React props
 */
export interface HtmlContentProps {
  pl?: string; // placeholder
  ti?: string; // title
  alt?: string; // alt
  arl?: string; // aria-label
  arb?: string; // aria-labelledby
  ard?: string; // aria-describedby
}

/**
 * Sanitized JSX Element representation (no IDs for stable hashing)
 */
export interface SanitizedElement {
  b?: Record<string, SanitizedChild>; // branches (for Branch/Plural components)
  c?: SanitizedChildren; // children
  t?: string; // transformation type or tag name
  d?: SanitizedGtProp; // GT data (for other GT components)
}

/**
 * Sanitized GT properties (no volatile data)
 */
export interface SanitizedGtProp extends HtmlContentProps {
  b?: Record<string, SanitizedChild>; // Branches
  t?: string; // Branch Transformation ('p' for plural, 'b' for branch)
}

/**
 * Sanitized Variable (no ID for stable hashing)
 */
export interface SanitizedVariable {
  k?: string; // key (for regular variables)
  v?: VariableType; // variable type (for regular variables)
  t?: string; // transformation type ('b' for branches, 'p' for plurals, 'v' for variables)
}

// Breaking circular reference using any for now - will be properly typed at runtime
export type SanitizedChild =
  | string
  | SanitizedElement
  | SanitizedVariable
  | boolean
  | null
  | any;
export type SanitizedChildren =
  | SanitizedChild
  | SanitizedChild[]
  | { c: SanitizedChildren };

/**
 * Sanitized data structure for hashing (matches TypeScript hashSource.ts)
 */
export interface SanitizedData {
  source?: SanitizedChildren;
  id?: string;
  context?: string;
  dataFormat?: string;
}

/**
 * Hash calculator for JSX content
 */
export class JsxHasher {
  /**
   * Hash a string using SHA256 and return first 16 hex characters
   * Matches the Rust implementation exactly
   */
  static hashString(input: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(input, 'utf8');
    const result = hash.digest('hex');
    return result.slice(0, 16);
  }

  /**
   * Stable stringify with alphabetically sorted keys
   * This ensures consistent hash generation regardless of object key order
   */
  static stableStringify(value: any): string {
    return JSON.stringify(value, Object.keys(value || {}).sort());
  }

  /**
   * Recursively sort object keys alphabetically for stable stringification
   */
  private static sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }

    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }

    return sortedObj;
  }

  /**
   * Stable stringify with recursive key sorting
   */
  static stableStringifyRecursive(value: any): string {
    const sorted = this.sortObjectKeys(value);
    return JSON.stringify(sorted);
  }

  /**
   * Generate hash for JSX content using sanitized data
   */
  static hashJsxContent(sanitizedData: SanitizedData): string {
    const jsonString = this.stableStringifyRecursive(sanitizedData);
    return this.hashString(jsonString);
  }

  /**
   * Create sanitized data structure for hashing
   */
  static createSanitizedData(
    source: SanitizedChildren,
    id?: string,
    context?: string
  ): SanitizedData {
    return {
      source,
      id,
      context,
      dataFormat: 'JSX',
    };
  }
  /**
   * Hash JSX content directly from components
   */
  static hashJsxSource(
    state: TransformState,
    source: SanitizedChildren,
    id?: string,
    context?: string
  ): string {
    const sanitizedData = this.createSanitizedData(source, id, context);
    return this.hashJsxContent(sanitizedData);
  }
}

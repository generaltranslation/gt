export type Scope =
  | 'no-T' // No check
  | 'T' // Check static
  | 'Branch' // Check attrs
  | 'Plural' // Check attrs
  | 'Branching-Attribute'; // Handle JsxExpressionContainers different

/**
 * Utility for tracking scope in JSX tree
 */
export class ScopeStack {
  private stack: Scope[] = [];

  constructor() {
    this.stack.push('no-T');
  }

  push(scope: Scope) {
    this.stack.push(scope);
  }

  pop() {
    this.stack.pop();
  }

  inTranslatableContent(): boolean {
    const scope = this.stack[this.stack.length - 1];
    return scope === 'T';
  }
  inBranchingComponent(): boolean {
    const scope = this.stack[this.stack.length - 1];
    return scope === 'Branch' || scope === 'Plural';
  }
  inBranchingAttribute(): boolean {
    return this.stack[this.stack.length - 1] === 'Branching-Attribute';
  }
  inBranchT(): boolean {
    return (
      this.stack.length >= 2 &&
      this.stack[this.stack.length - 1] === 'T' &&
      this.stack[this.stack.length - 2] === 'Branching-Attribute'
    );
  }
  getScope() {
    return this.stack[this.stack.length - 1];
  }
}

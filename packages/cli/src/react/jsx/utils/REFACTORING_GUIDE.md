# Refactoring Guide for parseJsx.ts and parseStringFunction.ts

This guide will help you ensure your refactoring doesn't change any behavior of these critical parsing functions.

## Overview

The test files created for behavioral verification:

1. **parseJsx.refactor.test.ts** - Comprehensive tests for JSX parsing
2. **parseStringFunction.refactor.test.ts** - Comprehensive tests for string function parsing

## Pre-Refactoring Steps

### 1. Run Tests and Create Baseline

```bash
# Run the refactoring tests
npm test parseJsx.refactor.test.ts
npm test parseStringFunction.refactor.test.ts

# Update snapshots to create baseline
npm test parseJsx.refactor.test.ts -- -u
npm test parseStringFunction.refactor.test.ts -- -u
```

### 2. Save Test Results

The snapshot files will be created in `__snapshots__/` directories. These represent the **exact current behavior** of the functions.

### 3. Document Current Behavior

Make note of:
- Total number of tests passing
- Any warnings or errors from the test run
- Execution time (to ensure refactoring doesn't degrade performance)

## During Refactoring

### Key Principles

1. **Never change test files** - These define the contract
2. **Run tests frequently** - After each logical change
3. **Watch for snapshot changes** - Any change needs careful review
4. **Check test coverage** - Ensure you're not missing edge cases

### What to Refactor Safely

✅ **Safe Changes:**
- Extract functions to improve readability
- Rename internal variables (not exported functions)
- Add comments and documentation
- Reorganize code structure
- Add type annotations
- Extract constants
- Simplify complex conditionals (while maintaining exact logic)

❌ **Unsafe Changes:**
- Changing function signatures
- Modifying return values
- Altering error messages
- Changing metadata structure
- Modifying hash generation logic
- Changing cache behavior
- Altering recursion detection logic

### Running Tests During Refactoring

```bash
# Run in watch mode for continuous feedback
npm test parseJsx.refactor.test.ts -- --watch
npm test parseStringFunction.refactor.test.ts -- --watch
```

## Post-Refactoring Verification

### 1. Run All Tests

```bash
# Run refactoring tests
npm test parseJsx.refactor.test.ts
npm test parseStringFunction.refactor.test.ts

# Run existing tests
npm test parseJsx.test.ts
npm test parseStringFunction.test.ts

# Run all tests
npm test
```

### 2. Verify Snapshots

If ANY snapshots changed:

```bash
# Review snapshot changes
git diff **/__snapshots__/
```

**CRITICAL:** Every snapshot change must be justified:
- Is this an intentional behavior change?
- Does it maintain backward compatibility?
- Have you updated documentation?

### 3. Performance Check

```bash
# Compare execution time before and after
npm test parseJsx.refactor.test.ts -- --reporter=verbose
npm test parseStringFunction.refactor.test.ts -- --reporter=verbose
```

Ensure performance hasn't degraded significantly.

### 4. Integration Testing

Run the full test suite to ensure no regressions:

```bash
npm test
```

## Specific Test Categories Explained

### parseJsx.refactor.test.ts

1. **Basic JSX Element Parsing**
   - Simple text content
   - Whitespace handling
   - Nested elements
   - Empty components

2. **Static Component Behavior**
   - All literal types (string, number, boolean, null)
   - Ternary expressions
   - Nested conditionals
   - Function calls

3. **Variable Components**
   - Var, Num, Plural, Branch components
   - Props handling
   - Special attributes

4. **Metadata Handling**
   - id, context, filePaths
   - staticId generation
   - Multiple metadata props

5. **Error and Warning Generation**
   - Unwrapped expressions
   - Nested T components
   - Recursive functions
   - Missing functions

6. **Hash Consistency**
   - Identical content produces same hash
   - Different content produces different hash
   - Static multiplication hashing

7. **Complex Integration Scenarios**
   - Multiple T components
   - Mixed content types
   - Deep nesting

8. **Edge Cases**
   - Long text
   - Special characters
   - Unicode
   - JSX fragments

### parseStringFunction.refactor.test.ts

1. **msg() Function Calls**
   - Simple strings
   - Template literals
   - Metadata options
   - Various contexts

2. **useGT() Hook Calls**
   - Basic usage
   - Metadata extraction
   - $maxChars handling
   - Error cases

3. **getGT() Async Hook**
   - Async function validation
   - All metadata types

4. **useMessages() and getMessages()**
   - Message-only mode
   - Dynamic content handling
   - Metadata ignoring

5. **Variable Aliases**
   - Simple aliases
   - Chained aliases
   - Circular references
   - Multiple usages

6. **Prop Drilling**
   - Function declarations
   - Arrow functions
   - Nested calls
   - Different parameter positions

7. **Cross-File Resolution**
   - Imported functions
   - Caching behavior
   - Re-exports
   - Circular imports

8. **Edge Cases**
   - Long strings
   - Special characters
   - ICU format
   - Empty strings

## Common Refactoring Patterns

### Pattern 1: Extracting Helper Functions

**Before:**
```typescript
function parseJSXElement(...) {
  // 100 lines of code
  if (condition) {
    // complex logic
  }
}
```

**After:**
```typescript
function parseJSXElement(...) {
  // 20 lines
  if (condition) {
    return handleComplexCase(...);
  }
}

function handleComplexCase(...) {
  // extracted complex logic
}
```

**Verification:**
- All tests still pass
- No snapshot changes
- Same inputs produce same outputs

### Pattern 2: Simplifying Conditionals

**Before:**
```typescript
if (a && b && !c || d && e) {
  // complex logic
}
```

**After:**
```typescript
const shouldProcess = (a && b && !c) || (d && e);
if (shouldProcess) {
  // same logic
}
```

**Verification:**
- Verify boolean logic is EXACTLY the same
- Test edge cases
- Check all branches are still covered

### Pattern 3: Improving Type Safety

**Before:**
```typescript
function process(node: any) {
  // ...
}
```

**After:**
```typescript
function process(node: t.Node) {
  // ...
}
```

**Verification:**
- No behavior changes
- Better IDE support
- Catches more errors at compile time

## Troubleshooting

### Tests Fail After Refactoring

1. **Check exact error message**
   ```bash
   npm test parseJsx.refactor.test.ts -- --reporter=verbose
   ```

2. **Compare outputs**
   - Use snapshot diffs to see what changed
   - Verify if change is intentional

3. **Isolate the change**
   - Comment out recent changes
   - Run tests again
   - Identify which change caused the failure

### Snapshot Changes Unexpectedly

1. **Review the diff carefully**
   ```bash
   git diff **/__snapshots__/
   ```

2. **Understand why it changed**
   - Is the new behavior correct?
   - Was the old behavior a bug?
   - Do you need to update documentation?

3. **Update snapshots only if intentional**
   ```bash
   npm test -- -u
   ```

### Performance Degradation

1. **Profile the code**
   - Use Node.js profiler
   - Identify slow functions

2. **Check cache behavior**
   - Ensure caches are still working
   - Verify cache keys are correct

3. **Review algorithmic changes**
   - Did complexity increase?
   - Are there unnecessary iterations?

## Checklist Before Committing

- [ ] All refactoring tests pass
- [ ] All existing tests pass
- [ ] No unintended snapshot changes
- [ ] Performance is maintained or improved
- [ ] Code coverage is maintained or increased
- [ ] Documentation is updated
- [ ] Type safety is maintained or improved
- [ ] No new linter warnings
- [ ] Git diff reviewed for unintended changes

## Best Practices

1. **Small, incremental changes** - Easier to identify issues
2. **Run tests frequently** - Catch problems early
3. **Document your changes** - Why, not just what
4. **Review snapshots carefully** - They define behavior
5. **Keep tests running fast** - Encourages frequent testing
6. **Don't skip tests** - They're your safety net

## Additional Resources

- [Babel AST Explorer](https://astexplorer.net/) - Understand AST structures
- [Vitest Documentation](https://vitest.dev/) - Test framework features
- [JSX Specification](https://facebook.github.io/jsx/) - JSX behavior reference

## Getting Help

If you're unsure about a change:

1. Check the test failures carefully
2. Review the snapshot diffs
3. Compare with existing implementation
4. Ask for code review
5. Document your concerns in comments

Remember: **The tests define the contract. If tests pass, behavior is preserved.**

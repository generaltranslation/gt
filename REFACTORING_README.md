# Refactoring Verification Test Suite

This test suite ensures that refactoring `parseJsx.ts` and `parseStringFunction.ts` doesn't change any behavior.

## 📋 Quick Start (3 Steps)

### Step 1: Before Refactoring
```bash
# Run this command to create baseline
./packages/cli/scripts/refactor-test.sh before

# Commit the baseline snapshots
git add packages/cli/**/__snapshots__/*.snap
git commit -m "test: add refactoring baseline snapshots"
```

### Step 2: Do Your Refactoring
Make your changes to:
- `packages/cli/src/react/jsx/utils/jsxParsing/parseJsx.ts`
- `packages/cli/src/react/jsx/utils/parseStringFunction.ts`

### Step 3: After Refactoring
```bash
# Run tests to verify behavior is unchanged
./packages/cli/scripts/refactor-test.sh after

# Compare results
./packages/cli/scripts/refactor-test.sh compare
```

## 📁 Files Created

### Test Files
Located in: `packages/cli/src/react/jsx/utils/`

1. **parseJsx.refactor.test.ts** (~36 tests)
   - Basic JSX parsing
   - Static components
   - Variable components (Var, Num, Plural, Branch)
   - Metadata handling
   - Error/warning generation
   - Hash consistency
   - Edge cases

2. **parseStringFunction.refactor.test.ts** (~61 tests)
   - msg() function calls
   - useGT() / getGT() hooks
   - useMessages() / getMessages() hooks
   - Variable aliases
   - Prop drilling (callback passing)
   - Cross-file function resolution
   - Edge cases

### Documentation
Located in: `packages/cli/src/react/jsx/utils/`

1. **REFACTORING_GUIDE.md** - Detailed guide with:
   - Pre-refactoring checklist
   - Safe vs unsafe changes
   - Common patterns
   - Troubleshooting

2. **TEST_SUMMARY.md** - Quick reference with:
   - Test coverage overview
   - Key metrics to track
   - Success criteria
   - Common issues

### Scripts
Located in: `packages/cli/scripts/`

1. **refactor-test.sh** - Automated testing script
   - Creates baseline
   - Runs tests
   - Compares results
   - Color-coded output

## 🎯 What the Tests Verify

### ✅ Behavior That Must Be Preserved

1. **Output Structure**
   - All updates have correct format: `{ dataFormat, source, metadata }`
   - Array structures match exactly
   - Nested objects are identical

2. **Metadata Extraction**
   - `id`, `context` extracted from props
   - `$maxChars` validated and converted correctly
   - `filePaths` always included
   - `staticId` generated for Static components

3. **Error Detection**
   - Unwrapped expressions caught
   - Recursive functions detected
   - Invalid metadata rejected
   - Template literals with expressions flagged

4. **Cross-File Resolution**
   - Imported functions resolved
   - Re-exports followed correctly
   - Caching works
   - Circular imports handled

5. **Hash Generation**
   - Identical content produces same hash
   - Different content produces different hash
   - Hash format consistent (16 chars)

## 🔧 Manual Testing (Alternative)

If you prefer not to use the script:

```bash
# Before refactoring
cd packages/cli
npm run test -- parseJsx.refactor.test.ts -u
npm run test -- parseStringFunction.refactor.test.ts -u
cd ../..
git add packages/cli/**/__snapshots__/*.snap
git commit -m "test: add baseline snapshots"

# After refactoring
cd packages/cli
npm run test -- parseJsx.refactor.test.ts
npm run test -- parseStringFunction.refactor.test.ts

# Check for snapshot changes
git diff **/__snapshots__/
```

## 📊 Success Criteria

Your refactoring is successful when:

- [x] All 97+ tests pass
- [x] No unintended snapshot changes
- [x] Performance maintained or improved
- [x] Code is more readable
- [x] Type safety maintained or improved

## ⚠️ Important Notes

### DO NOT Change
- Test files themselves (they define the contract)
- Expected outputs in snapshots (unless intentional)
- Function signatures (public API)
- Return value structures
- Error message formats

### Safe to Change
- Internal variable names
- Code organization
- Comments and documentation
- Type annotations
- Private helper functions
- Performance optimizations (if behavior unchanged)

## 🐛 Troubleshooting

### Tests Fail After Refactoring

1. **Check the error:**
   ```bash
   cd packages/cli
   npm run test -- parseJsx.refactor.test.ts --reporter=verbose
   ```

2. **Review snapshot changes:**
   ```bash
   git diff **/__snapshots__/
   ```

3. **Compare outputs:**
   - Look at what changed
   - Verify if intentional
   - Update docs if needed

### Snapshot Changes Unexpectedly

Only update snapshots if the change is intentional:
```bash
cd packages/cli
npm run test -- parseJsx.refactor.test.ts -u  # Update snapshots
```

But review carefully first:
```bash
git diff **/__snapshots__/
```

### Performance Issues

Profile to find slow code:
```bash
cd packages/cli
npm run test -- parseJsx.refactor.test.ts --reporter=verbose
```

Check:
- Cache is still working
- No unnecessary iterations
- Algorithm complexity unchanged

## 📈 Test Coverage

| File | Tests | Categories |
|------|-------|-----------|
| parseJsx.refactor.test.ts | ~36 | 8 categories |
| parseStringFunction.refactor.test.ts | ~61 | 10 categories |
| **TOTAL** | **~97** | **18 categories** |

### Key Test Categories

**parseJsx.ts:**
- JSX element parsing
- Static component behavior
- Variable components
- Metadata handling
- Error/warning generation
- Hash consistency
- Complex integration scenarios
- Edge cases

**parseStringFunction.ts:**
- Translation function calls (msg, useGT, getGT)
- Hook validation (async/sync)
- Variable aliasing
- Prop drilling
- Cross-file resolution
- Caching behavior
- Edge cases

## 📚 Additional Resources

- **REFACTORING_GUIDE.md** - Detailed step-by-step guide
- **TEST_SUMMARY.md** - Quick reference and metrics
- [Babel AST Explorer](https://astexplorer.net/) - Explore AST structures
- [Vitest Docs](https://vitest.dev/) - Test framework reference

## 🤝 Getting Help

If you encounter issues:

1. Check the test error messages
2. Review the guides in `packages/cli/src/react/jsx/utils/`
3. Compare with the original implementation
4. Ask for code review

## ✨ Example Workflow

```bash
# 1. Create baseline
./packages/cli/scripts/refactor-test.sh before
git add **/__snapshots__/*.snap
git commit -m "test: add refactoring baseline"

# 2. Make your changes
# Edit parseJsx.ts or parseStringFunction.ts

# 3. Verify behavior unchanged
./packages/cli/scripts/refactor-test.sh after
./packages/cli/scripts/refactor-test.sh compare

# 4. If all tests pass
git add .
git commit -m "refactor: improve code readability

- Extracted helper functions
- Added type annotations
- Simplified conditionals
- All tests passing, behavior unchanged"
```

## 🎉 Success!

If you see this message:
```
✅ ALL TESTS PASSED - Refactoring preserved behavior!
```

Your refactoring is safe to commit! 🚀

---

**Remember:** The tests define the contract. If tests pass, behavior is preserved.

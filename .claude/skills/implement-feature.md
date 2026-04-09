---
name: implement-feature
description: 5-phase workflow for implementing features (understand, test, implement, stress-test, validate)
user-invocable: true
allowed-tools: Agent, Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, EnterPlanMode, ExitPlanMode, TaskCreate, TaskUpdate
argument-hint: '<description of the feature to implement>'
---

Guide a feature through a 5-phase implementation workflow. The feature is: `$ARGUMENTS`

Ask clarifying questions before starting if the request is ambiguous.

## Phase 1: Understand

Become a staff-level expert in the code areas involved. Use Explore agents (in parallel) to deeply understand the existing implementation, patterns, and conventions. Read relevant source files, tests, and documentation.

**Output**: Summarize your understanding and confirm with the user before proceeding.

## Phase 2: Gold Standard Tests

Write tests FIRST that define the expected behavior. These are locked-in contracts — any changes require strong justification.

- Write 2-4 high-quality tests per affected package
- Tests should be black-box: test behavior, not implementation
- Include both "should work" and "should still fail" (control) cases
- Follow existing test patterns in each package exactly
- All tests should FAIL initially (proving they test new behavior)
- Use parallel agents to write tests across packages simultaneously

**Output**: Commit the tests. Report which pass and which fail. Confirm with user before proceeding.

## Phase 3: Implementation

Make the minimal changes to pass all gold standard tests.

- Enter plan mode first — design the approach and get user approval
- Keep changes surgical: don't refactor surrounding code
- Use parallel agents for independent packages
- Run tests after implementation to verify all pass
- Minimize code footprint
- Observe existing patterns and conventions (constants, naming, file structure, etc.)

**Output**: Report test results. All gold standard tests must pass, all existing tests must still pass.

## Phase 4: Edge Case Testing

Write extensive adversarial tests to stress-test the implementation.

- Draw inspiration from existing edge case tests in the codebase
- Cover: nesting, cross-products, scope isolation, type coercion, component interactions, guard conditions
- Include both autoderive-ON and autoderive-OFF (control) variants
- Aim for 10-15 tests per package
- Use parallel agents

**Output**: Report test results. Fix any failures found.

## Phase 5: E2E Validation

Test in real sample apps to verify the feature works end-to-end.

- Create sample apps (Vite + Next.js or whatever frameworks are relevant)
- Link local packages via `pnpm link`
- Set up config with the feature enabled
- Test both CLI tools and build steps
- Document any failures or limitations found

**Output**: Report what passed and what failed. Note any limitations.

## Guidelines

- Ask the user questions at phase boundaries — don't assume
- Use parallel agents wherever packages are independent
- Each phase should be confirmed with the user before moving to the next
- If a phase reveals issues, go back and fix before proceeding
- Keep the user informed of progress at natural milestones

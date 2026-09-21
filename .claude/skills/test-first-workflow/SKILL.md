---
name: test-first-workflow
description: Use when asked to implement a feature or fix a bug in this project. Enforces writing/updating tests first, making them pass with the minimum code, and running the whole suite.
---

# Test-first workflow (Quento Padel Club)

Apply this every time a feature or fix is requested.

## Steps

1. **Understand the change.** Read the related action/entity/test files and match their style.
2. **Write or modify the tests first.**
   - Feature: new tests covering the expected behavior, including edge cases and error paths.
   - Fix: a test that reproduces the bug and fails for the right reason.
   - Logic that changes existing behavior: update the affected existing tests.
   - Unit tests go in `test/unit/*.test.ts` (no DB). If the change touches the database, also add integration tests in `test/integration/*.integration.test.ts`.
3. **Run the new tests and confirm they fail** (red) with the expected failure, not a typo or setup error.
4. **Write the minimum code needed to make them pass** (green).
   - No speculative features, extra options, abstractions, or refactors beyond what the tests require.
   - Don't touch unrelated code.
   - If more behavior is wanted, write a test for it first.
5. **Run the whole suite**: `pnpm test:integration:db:up` (if the test DB is not running), then `pnpm test:all`. All tests must pass, not only the new ones. Also run `pnpm lint`.
6. **Report honestly**: state which tests were added/changed and the real result of the run. If something fails or could not be run, say so; never mark the task done with failing tests.

## Conventions

- Code, identifiers, comments and test names in English; user-facing texts in Spanish.
- Never delete or weaken an existing test just to make it pass; change it only if the requirement itself changed, and say so.
- If the entity model changes, generate a migration and update the diagrams in `docs/`.

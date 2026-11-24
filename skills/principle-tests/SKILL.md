---
name: principle-tests
description: Use when writing, reading, or running tests, so every test guards logic that matters and none keeps dead code alive.
user-invocable: false
---

# Tests

A test earns its place by catching a regression in logic that matters. A test written only to have one costs run time and review time, and can keep dead code alive.

Write or keep a test only when it guards:
- a business rule, edge case, or error path
- a bug that happened, so it cannot happen again
- a contract other code depends on

Delete or do not write a test that:
- asserts on mocks rather than behaviour
- tests the language, a framework, or a library
- only checks that something renders, exists, or does not throw
- repeats a case another test already covers through the same path
- snapshots the implementation

## Dead code

A test is a caller. Code whose only callers are tests is dead, and the test is what keeps it alive.

Before you write a test, check the code under test has a production caller. When you find code that only tests reach, confirm it is dead with a repo-wide search (reflection, string lookups, config, codegen inputs, exported library API), then delete the code and its tests together.

## Clean up

When you write, read, or run tests for a task, delete the ones among them that fail the rules above. Tests already in the repo get no exemption.

Put the deletions in their own commit so a reviewer can revert them separately, and run the suite after. For a repo-wide sweep with coverage stats, use the `cleanup` skill.

Do not open test files only to delete tests.

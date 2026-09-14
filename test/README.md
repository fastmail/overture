# Overture tests

Unit tests for the Overture source, using only Node's built-in test runner
(`node:test`) and assertion library (`node:assert`). No test framework or other
package is imported.

## Running

```sh
npm test                              # all test files under test/
node --test 'test/**/*.test.mjs'      # same thing, directly
node --test test/datastore/query/WindowedQuery.test.mjs   # a single file
```

Requires a Node version with a stable test runner (Node 20+).

## Layout

Test files mirror the `source/` tree and are named `*.test.mjs`. Shared
fixtures and factories live in `helpers.mjs` files (and `*.fixture.mjs` data
modules), which are *not* named `*.test.mjs` so the runner does not execute
them directly.

```
test/
  animation/
    helpers.mjs                       # DOM stubs, fake element + Web Animations
    StyleAnimation.test.mjs
  datastore/
    helpers.mjs                       # shared store/query factories
    Status.test.mjs
    store/Store.test.mjs
    store/NestedStore.test.mjs
    store/UndoManager.test.mjs         # UndoManager + StoreUndoManager
    store/MemoryManager.test.mjs
    source/AggregateSource.test.mjs
    query/LocalQuery.test.mjs
    query/WindowedQuery.test.mjs       # incl. Sentry 7380278134 regression
    query/windowed-query-sentry.fixture.mjs
    record/RecordAttribute.test.mjs    # attr, validation, toOne, toMany
    record/RecordResult.test.mjs       # getResult / ifSuccess promises
    record/ValidationError.test.mjs
```

## Notes

- The datastore tests run the **real** `Store`, `Record`, `LocalQuery` and
  `WindowedQuery` classes against a scriptable mock `Source`. The store defers
  change-detection and commits to the run loop, so tests call `flush()`
  (`RunLoop.flushAllQueues()`) where they need those side effects to have run.
- `WindowedQuery` tests use a lightweight mock store (just the store-key
  mapping surface the query touches) since they never materialise records.

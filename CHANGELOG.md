# Changelog

## Miscellaneous changes

- 2017-11-23: changed `O.View#allowTextSelection` to support and default to null (mostly harmless, but will change some behaviour).
- 2017-11-11: added `O.Record#getData`

## 2017-10-16: better `Promise` support

## Added

- `O.Promise`, a subclass of the native `Promise` which executes the `onFulfilled` and `onRejected` functions in the run loop, via `O.RunLoop.invoke`, ensuring that promises won’t produce surprising behaviour.

## Changed

- The global `Promise` is overridden to set it to `O.Promise`. This is convenient, probably harmless and makes `async function` Overture-ready—not that native browser support is yet wide!
- `O.RunLoop.invoke` now returns the return value of the function, rather than `RunLoop`. (But bear in mind that the run loop queues will be flushed between the completion of the function and the return of that value, so if caution is not exercised that value could be stale.)
- Functions wrapped in the run loop via `Function#invokeInRunLoop` will now return the value returned by the wrapped function, not `undefined`.

## 2017-10-16: query refactoring

Queries were refactored quite a bit to make more sense, with some renamings and some mild changes in behaviour.

### Changed

- Renamed `RemoteQuery` to `Query`.
- Renamed `WindowedRemoteQuery` to `WindowedQuery`.
- Renamed `LiveQuery` to `LocalQuery`.
- Renamed `Query#refresh` to `Query#fetch`. (It also now takes an optional extra argument, callback.)
- Renamed `Record#refresh` to `Record#fetch`.
- Renamed `Store#getAllRemoteQueries` to `Store#getAllQueries`.
- `LocalQuery` is now a subclass of `Query` rather than of `O.Object`.
- There are a handful of internal implementation details that changed (keywords of some methods introduced or changed: monitorForChanges, unmonitorForChanges, reset, getStoreKeys, sourceDidFetchQuery, typeStatusChanged, storeDidChangeRecords).
- Removed now-unnecessary methods `Store#setRemoteQueriesObsolete`, `Store#refreshLiveQueries` and `Store#liveQueriesAreReady`.
- Renamed `Query#filter` to `Query#where`, to fix the collision on the `Enumerable.filter` method.
- New property `Query#autoRefresh`, controlling the eponymous behaviour on the query, defaulting to `AUTO_REFRESH_NEVER` on `Query` and `AUTO_REFRESH_ALWAYS` on `LocalQuery`. (These are the same semantics as were previously present, but it gives the flexibility to change it.)
- New static properties `RemoteQuery.AUTO_REFRESH_NEVER`, `RemoteQuery.AUTO_REFRESH_IF_OBSERVED` and `RemoteQuery.AUTO_REFRESH_ALWAYS` for `Query#autoRefresh`.

### Added

- Observable property `Store#typeToStatus`.
  (Formerly it was a private, unobservable property named `_typeToStatus`.)
- New method `Store#getRecordFromStoreKey`, replacing a common pattern of `Store#getRecord` usage.
- Support for unordered `toMany` attribute. (Represented as object with `{ id1: true, id2: true }` instead of `[ id1, id2 ]`.)

## 2017-10-06: modernisation

### Added

- Support for building via npm. Now, `npm install` or `yarn` will make
  `build/Overture.js`, which is the main entry point for the Node
  module, and `build/Loader.js`.

  The makefile is still around, but frankly it’s not very useful,
  because doc building is progressively becoming more broken and the
  minification isn’t what we need any more. It’ll disappear eventually.
  (Note also the difference in filenames: the makefile produces
  Overture-raw.js and Overture-‹HASH›.js, the node package produces
  just Overture.js.)

### Changed

- Recommendation: in constructor super calls such as
  `Foo.parent.init.call( this, … )`, change `init` to `constructor` for
  easy forwards compatibility with ES6 classes.

### Deprecated

- Deprecated `O.Element.addClass`, `O.Element.removeClass` and
  `O.Element.hasClass`, in favour of the now well-supported†
  `Element.classList` API:

  - `addClass( el, className )` → `el.classList.add( className )`
  - `removeClass( el, className )` → `el.classList.remove( className )`
  - `hasClass( el, className )` → `el.classList.contains( className )`

  Element.classList is a read-only property, so it’s OK to store the
  classList in your object instead of always writing `el.classList.add`.

  Note that the `classList` API will throw exceptions if you pass class
  name containing spaces, whereas the old `O.Element.*Class` API would
  either work or fail silently. The deprecated methods have actually
  changed to use classList directly, so they will now fail in such
  cases.

  († I say “well supported”, but IE 11 actually doesn’t implement
  classList on SVG elements. If this matters to you, get a polyfill like
  https://github.com/eligrey/classList.js.)

## 2017-09-12: modernisation

### Changed

- O.ViewEventsController.getViewFromNode moved to O.getViewFromNode

### Added

- O.activeViews

### Removed

- O.ViewEventsController.{registerActiveView, deregisterActiveView}

## Some time in the first half of 2017: modernisation

### Removed

- Support for IE8–10 dropped. IE11 is the lowest base browser now.

  (At the time of the change, Overture actually worked in IE 10 with
  core-js, but this is not a supported configuration.)

### Changed

- Overture itself is also starting to use certain newer browser
  features; to support anything but the latest versions of browsers,
  Overture users are expected to load core-js before loading Overture.
  `Object.values` is recommended as a value to check for to determine
  whether core-js is needed: it will be needed by IE 11, Safari ≤ 10.0,
  iOS ≤ 10.2, Chrome ≤ 53, Firefox ≤ 46 and Edge ≤ ?13, but the latest
  versions of browsers don’t need it.

- The code changed from using a custom build process to using Rollup;
  the complete code must now be generated with `make compile`, which
  will create `build/Overture-raw.js` and `build/Loader-raw.js`.
  (Commands like `make build/Overture-raw.js` are also fine.)

  The old custom build process is still around for anything that already
  used it, but it should be considered deprecated.

## Older

No changelogs maintained.

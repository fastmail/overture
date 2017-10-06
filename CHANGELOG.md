# Changelog

## 2017-09-12

### Changed

- O.ViewEventsController.getViewFromNode moved to O.getViewFromNode

### Added

- O.activeViews

### Removed

- O.ViewEventsController.{registerActiveView, deregisterActiveView}

## Some time in the first half of 2017

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

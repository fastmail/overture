# Changelog

## 2017-10-06

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

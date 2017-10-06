// TODO: add a dependency on core-js or es6-shim or some such thing for IE 11 to
// polyfill any missing functionality without bloating everyone else.
//
// This will allow us to assume:
//
// - Object.assign (which admittedly our Function#implement and Function#extend
//   kinda do already, but I want to nuke them)
// - Object.values (which we already have a polyfill for)
// - String#repeat (which we already have a simplistic polyfill for)
// - Map and Set (which could be handy in some record things in particular, I
//   think; Array#include and Array#erase smell like poor man’s Set)

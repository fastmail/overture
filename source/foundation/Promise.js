import './RunLoop';  // For Function#invokeInRunLoop

const NativePromise = Promise;
const NativePromisePrototype = NativePromise.prototype;

/**
    Class: O.Promise
    Extends: Promise

    This is a small extension of the native `Promise` that runs the asynchronous
    onFulfilled and onRejected functions in the run loop.

    It is intended to supplant the global `Promise`.
*/
/*
    Implementation note: with class syntax, parts work just fine and dandy; but
    when you transpile class syntax to the older function syntax, it breaks: the
    constructor looks like this:

        function OPromise () {
            NativePromise.apply(this, arguments);
        }

    And browsers don’t like that; Firefox’s opinion is: “TypeError: calling a
    builtin Promise constructor without new is forbidden”.

    (Similarly, using static methods like `OPromise.then()` break without the
    static method declarations. Native functionality is often weird. ☹)

    So because we still care about IE 11 which doesn’t support class syntax,
    we are constrained to use a different technique for the constructor, one
    which is incompatible with class syntax, and so the entire thing stops
    working as a class. ☹
*/
const OPromise = Object.setPrototypeOf( function OPromise ( executor ) {
    return Object.setPrototypeOf( new NativePromise( executor ),
        OPromise.prototype );
}, NativePromise );

Object.assign( OPromise, {
    prototype: Object.assign( Object.create( NativePromisePrototype ), {
        constructor: OPromise,

        then ( onFulfilled, onRejected ) {
            return NativePromisePrototype.then.call( this,
                typeof onFulfilled === 'function' ?
                    onFulfilled.invokeInRunLoop() :
                    onFulfilled,
                typeof onRejected === 'function' ?
                    onRejected.invokeInRunLoop() :
                    onRejected );
        },
    }),


    all ( iterable ) {
        return NativePromise.all.call( this, iterable );
    },

    race ( iterable ) {
        return NativePromise.race.call( this, iterable );
    },

    reject ( reason ) {
        return NativePromise.reject.call( this, reason );
    },

    resolve ( value ) {
        return NativePromise.resolve.call( this, value );
    },
});

export default OPromise;

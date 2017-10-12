import './RunLoop';  // For Function#invokeInRunLoop

const NativePromise = Promise;

/**
    Class: O.Promise
    Extends: Promise

    This is a small extension of the native `Promise` that runs the asynchronous
    onFulfilled and onRejected functions in the run loop.

    It is intended to supplant the global `Promise`.
*/
class OPromise extends NativePromise {
    // No need to override the constructor: the executor runs immediately.

    then ( onFulfilled, onRejected ) {
        return super.then( onFulfilled.invokeInRunLoop(),
                           onRejected && onRejected.invokeInRunLoop() );
    }

    catch ( onRejected ) {
        return super.catch( onRejected.invokeInRunLoop() );
    }

    // In at least Firefox (I didn’t test any other browsers), using these
    // methods via inheritance blows up (something about needing `new` to
    // construct a promise, which is simply wonky). Hence these definitions
    // which just defer straight to super, to make the JS engine happy.

    static all ( iterable ) {
        return super.all( iterable );
    }

    static race ( iterable ) {
        return super.race( iterable );
    }

    static reject ( reason ) {
        return super.reject( reason );
    }

    static resolve ( value ) {
        return super.resolve( value );
    }
}

export default OPromise;

// -------------------------------------------------------------------------- \\
// File: RunLoop.js                                                           \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
         console */

"use strict";

( function ( NS, setImmediate ) {

/**
    Class: O.RunLoop

    The run loop allows data to propagate through the app in stages, preventing
    multiple changes to an object firing off the same observers several times.
    To use, wrap the entry point functions in a call to <O.RunLoop.invoke>.
*/

var RunLoop = {
    /**
        Property (private): NS.RunLoop._queueOrder
        Type: Array.<String>

        The order in which to flush the queues.
    */
    _queueOrder: [ 'before', 'bindings', 'middle', 'render', 'after' ],

    /**
        Property (private): NS.RunLoop._queues
        Type: Object

        Collection of queues. Each queue contains [fn, bind] tuples to call at
        <O.RunLoop.end>.
    */
    _queues: {
        before: [],
        bindings: [],
        middle: [],
        render: [],
        after: []
    },

    /**
        Property (private): NS.RunLoop._depth
        Type: Number

        Number of calls to <O.RunLoop.invoke> currently in stack.
    */
    _depth: 0,

    /**
        Method: O.RunLoop.flushQueue

        Invokes each function in an array of [function, object] tuples, binding
        the this parameter of the function to the object, and empties the array.

        Parameters:
            queue - {String} name of the queue to flush.

        Returns:
            {Boolean} Were any functions actually invoked?
    */
    flushQueue: function ( queue ) {
        var toInvoke = this._queues[ queue ],
            l = toInvoke.length,
            i, tuple;

        if ( l ) {
            this._queues[ queue ] = [];

            for ( i = 0; i < l; i += 1 ) {
                tuple = toInvoke[i];
                try {
                    tuple[0].call( tuple[1] );
                }
                catch ( error ) {
                    RunLoop.didError( error );
                }
            }
            return true;
        }
        return false;
    },

    /**
        Method: O.RunLoop.flushAllQueues

        Calls O.RunLoop#flushQueue on each queue in the order specified in
        _queueOrder, starting at the first queue again whenever the queue
        indicates something has changed.

        Parameters:
            queue - {String} name of the queue to flush.

        Returns:
            {Boolean} Were any functions actually invoked?
    */
    flushAllQueues: function () {
        var order = this._queueOrder,
            i = 0, l = order.length;
        while ( i < l ) {
            i = this.flushQueue( order[i] ) ? 0 : i + 1;
        }
    },

    /**
        Method: O.RunLoop.queueFn

        Add a [function, object] tuple to a queue, ensuring it is not added
        again if it is already there.

        Parameters:
            queue     - {String} The name of the queue to add the tuple to.
            fn        - {Function} The function to add to the array.
            bind      - {(Object|undefined)} The object the function will be
                        bound to when called.
            allowDups - {Boolean} (optional) If not true, will search queue to
                        check this fn/bind combination is not already present.

        Returns:
            {O.RunLoop} Returns self.
    */
    queueFn: function ( queue, fn, bind, allowDups ) {
        var toInvoke = this._queues[ queue ],
            l = toInvoke.length,
            i, tuple;
        if ( !allowDups ) {
            for ( i = 0; i < l; i += 1 ) {
                tuple = toInvoke[i];
                if ( tuple[0] === fn && tuple[1] === bind ) {
                    return this;
                }
            }
        }
        toInvoke[l] = [ fn, bind ];
        return this;
    },

    /**
        Method: O.RunLoop.invoke

        Invoke a function inside the run loop. Note, to pass arguments you must
        supply a bind; use `null` if you would like the global scope.

        Parameters:
            fn   - {Function} The function to invoke
            bind - {Object} (optional) The object to bind `this` to when calling
                   the function.
            args - {Array} (optional) The arguments to pass to the function.

        Returns:
            {O.RunLoop} Returns self.
    */
    invoke: function ( fn, bind, args ) {
        this._depth += 1;
        try {
            // IE8 will throw an error if args is undefined
            // when calling fn.apply for some reason.
            // Avoiding apply/call when not needed is also probably more
            // efficient.
            if ( args ) {
                fn.apply( bind, args );
            } else if ( bind ) {
                fn.call( bind );
            } else {
                fn();
            }
        } catch ( error ) {
            RunLoop.didError( error );
        }
        if ( this._depth === 1 ) {
            this.flushAllQueues();
        }
        this._depth -= 1;
        return this;
    },

    /**
        Property (private): NS.RunLoop._nextLoopQueue
        Type: Array.<Array>

        An array of `[fn,bind]` tuples which are to be invoked in the next event
        loop.
    */
    _nextLoopQueue: null,

    /**
        Method (private): O.RunLoop._callNextLoopQueue

        Invokes all the functions waiting in the <#_nextLoopQueue> queue.
    */
    _callNextLoopQueue: function () {
        var nextLoopQueue = this._nextLoopQueue,
            i, l, tuple;
        this._nextLoopQueue = null;
        for ( i = 0, l = nextLoopQueue.length; i < l; i += 1 ) {
            tuple = nextLoopQueue[i];
            tuple[0].call( tuple[1] );
        }
    },

    /**
        Method: O.RunLoop.invokeInNextEventLoop

        Use this to invoke a function in a new browser event loop, immediately
        after this event loop has finished.

        Parameters:
            fn   - {Function} The function to invoke.
            bind - {Object} (optional) The object to make the 'this' parameter
                   when the function is invoked.

        Returns:
            {O.RunLoop} Returns self.
    */
    invokeInNextEventLoop: function ( fn, bind ) {
        var nextLoopQueue = this._nextLoopQueue,
            that = this;
        if ( !nextLoopQueue ) {
            this._nextLoopQueue = nextLoopQueue = [];
            setImmediate( function () {
                RunLoop.invoke( that._callNextLoopQueue, that );
            });
        }
        nextLoopQueue.push([ fn, bind ]);
        return this;
    },

    /**
        Method: O.RunLoop.invokeAfterDelay

        Use this to invoke a function after a specified delay. The function will
        be called inside a new RunLoop, and optionally bound to a supplied
        object.

        Parameters:
            fn    - {Function} The function to invoke after a delay.
            delay - {Number} The delay in milliseconds.
            bind  - {Object} (optional) The object to make the 'this' parameter
                    when the function is invoked.

        Returns:
            {InvocationToken} Returns a token that can be passed to the
            <O.RunLoop.cancel> method before the function is invoked, in order
            to cancel the scheduled invocation.
    */
    invokeAfterDelay: function ( fn, delay, bind ) {
        return setTimeout( function () {
            RunLoop.invoke( fn, bind );
        }, delay );
    },

    /**
        Method: O.RunLoop.invokePeriodically

        Use this to invoke a function periodically, with a set time between
        invocations.

        Parameters:
            fn     - {Function} The function to invoke periodically.
            period - {Number} The period in milliseconds between invocations.
            bind   - {Object} (optional) The object to make the 'this' parameter
                     when the function is invoked.

        Returns:
            {InvocationToken} Returns a token that can be passed to the
            <O.RunLoop.cancel> method to cancel all future invocations scheduled
            by this call.
    */
    invokePeriodically: function ( fn, period, bind ) {
        return setInterval( function () {
            RunLoop.invoke( fn, bind );
        }, period );
    },

    /**
        Method: O.RunLoop.cancel

        Use this to cancel the future invocations of functions scheduled with
        the <O.RunLoop.invokeAfterDelay> or <O.RunLoop.invokePeriodically>
        methods.

        Parameters:
            token - {InvocationToken} The InvocationToken returned by the
                    call to invokeAfterDelay or invokePeriodically that you wish
                    to cancel.

        Returns:
            {O.RunLoop} Returns self.
    */
    cancel: function ( token ) {
        clearTimeout( token );
        clearInterval( token );
        return this;
    },

    /**
        Method: O.RunLoop.didError

        This method is invoked if an uncaught error is thrown in a run loop.
        Overwrite this method to do something more useful then just log the
        error to the console.

        Parameters:
            error - {Error} The error object.
    */
    didError: function ( error ) {
        console.log( error.name, error.message, error.stack );
    }
};

NS.RunLoop = RunLoop;

Function.implement({
    /**
        Method: Function#queue

        Parameters:
            queue - {String} The name of the queue to add calls to this function
                    to.

        Returns:
            {Function} Returns wrapper that passes calls to
            <O.RunLoop.queueFn>.
    */
    queue: function ( queue ) {
        var fn = this;
        return function () {
            RunLoop.queueFn( queue, fn, this );
            return this;
        };
    },

    /**
        Method: Function#later

        Modifies the function so that when it is called, it will actually be
        invoked in the next event loop.

        Returns:
            {Function} Returns wrapped function.
    */
    later: function () {
        var fn = this;
        return function () {
            RunLoop.invokeInNextEventLoop( fn, this );
            return this;
        };
    },

    /**
        Method: Function#invokeInRunLoop

        Wraps any calls to this function inside a call to <O.RunLoop.invoke>.

        Returns:
            {Function} Returns wrapped function.
    */
    invokeInRunLoop: function () {
        var fn = this;
        return function () {
            RunLoop.invoke( fn, this, arguments );
        };
    }
});

}( this.O,
   typeof setImmediate !== 'undefined' ?
        setImmediate :
        function ( fn ) {
            return setTimeout( fn, 0 );
        }
) );

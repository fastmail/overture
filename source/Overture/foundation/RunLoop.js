// -------------------------------------------------------------------------- \\
// File: RunLoop.js                                                           \\
// Module: Foundation                                                         \\
// Requires: Core, Heap.js                                                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global setTimeout, clearTimeout, setImmediate, console */

"use strict";

( function ( NS, win, setImmediate ) {

var requestAnimFrame =
    win.requestAnimationFrame       ||
    win.oRequestAnimationFrame      ||
    win.webkitRequestAnimationFrame ||
    win.mozRequestAnimationFrame    ||
    win.msRequestAnimationFrame     ||
    ( function () {
        var lastTime = 0;
        return function ( callback ) {
            var time = Date.now(),
                timeToNextCall = Math.max( 0, 16 - ( time - lastTime ) );
                lastTime = time;
            win.setTimeout( function () {
                callback( time + timeToNextCall );
            }, timeToNextCall );
        };
    }() );

var Timeout = function ( time, period, fn, bind ) {
    this.time = time;
    this.period = period;
    this.fn = fn;
    this.bind = bind;
};

/**
    Class: O.RunLoop

    The run loop allows data to propagate through the app in stages, preventing
    multiple changes to an object firing off the same observers several times.
    To use, wrap the entry point functions in a call to <O.RunLoop.invoke>.
*/

var RunLoop = {

    mayRedraw: false,

    /**
        Property (private): NS.RunLoop._queueOrder
        Type: String[]

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
        after: [],
        nextLoop: [],
        nextFrame: []
    },

    /**
        Property (private): NS.RunLoop._timeouts
        Type: O.Heap

        A priority queue of timeouts.
    */
    _timeouts: new NS.Heap( function ( a, b ) {
        return a.time - b.time;
    }),

    /**
        Property (private): NS.RunLoop._nextTimeout
        Type: Number

        Epoch time that the next browser timeout is scheduled for.
    */
    _nextTimeout: 0,

    /**
        Property (private): NS.RunLoop._timer
        Type: Number

        The browser timer id (response from setTimeout), which you need if
        you want to cancel the timeout.
    */
    _timer: null,

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
            i, tuple, fn, bind;

        if ( l ) {
            this._queues[ queue ] = [];

            for ( i = 0; i < l; i += 1 ) {
                tuple = toInvoke[i];
                fn = tuple[0];
                bind = tuple[1];
                try {
                    if ( bind ) {
                        fn.call( bind );
                    } else {
                        fn();
                    }
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
            // Render waits for next frame, except if in bg, since
            // animation frames don't fire while in the background
            // and we want to flush queues in a reasonable time, as they may
            // redraw the tab name, favicon etc.
            if ( i === 3 && !this.mayRedraw && !document.hidden ) {
                this.invokeInNextFrame( this.flushAllQueues, this );
                return;
            }
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
        // Log error here, as the stack trace is useless inside flushQueue.
        if ( !fn ) {
            try {
                fn();
            } catch ( error ) {
                RunLoop.didError( error );
            }
        } else {
            if ( !allowDups ) {
                for ( i = 0; i < l; i += 1 ) {
                    tuple = toInvoke[i];
                    if ( tuple[0] === fn && tuple[1] === bind ) {
                        return this;
                    }
                }
            }
            toInvoke[l] = [ fn, bind ];
        }
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
        if ( !this._depth ) {
            this.processTimeouts();
        }
        return this;
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
        var nextLoopQueue = this._queues.nextLoop;
        if ( !nextLoopQueue.length ) {
            setImmediate( nextLoop );
        }
        nextLoopQueue.push([ fn, bind ]);
        return this;
    },

    /**
        Method: O.RunLoop.invokeInNextFrame

        Use this to invoke a function just before the browser next redraws.

        Parameters:
            fn   - {Function} The function to invoke.
            bind - {Object} (optional) The object to make the 'this' parameter
                   when the function is invoked.

        Returns:
            {O.RunLoop} Returns self.
    */
    invokeInNextFrame: function ( fn, bind ) {
        var nextFrameQueue = this._queues.nextFrame;
        if ( !nextFrameQueue.length ) {
            requestAnimFrame( nextFrame );
        }
        nextFrameQueue.push([ fn, bind ]);
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
        var timeout = new Timeout( Date.now() + delay, 0, fn, bind );
        this._timeouts.push( timeout );
        this._scheduleTimeout();
        return timeout;
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
        var timeout = new Timeout( Date.now() + period, period, fn, bind );
        this._timeouts.push( timeout );
        this._scheduleTimeout();
        return timeout;
    },

    /**
        Method (private): NS.RunLoop._scheduleTimeout

        Sets the browser timer if necessary to trigger at the time of the next
        timeout in the priority queue.
    */
    _scheduleTimeout: function () {
        var timeout = this._timeouts.peek(),
            time = timeout ? timeout.time : 0,
            delay;
        if ( time && time !== this._nextTimeout ) {
            clearTimeout( this._timer );
            delay = time - Date.now();
            if ( delay > 0 ) {
                this._timer = setTimeout( processTimeouts, time - Date.now() );
                this._nextTimeout = time;
            } else {
                this._nextTimeout = 0;
            }
        }
    },

    /**
        Method: NS.RunLoop.processTimeouts

        Invokes all functions in the timeout queue that were scheduled to
        trigger on or before "now".

        Returns:
            {O.RunLoop} Returns self.
    */
    processTimeouts: function () {
        var timeouts = this._timeouts,
            timeout, period;
        while ( timeouts.length && timeouts.peek().time <= Date.now() ) {
            timeout = timeouts.pop();
            if ( period = timeout.period ) {
                timeout.time = Date.now() + period;
                timeouts.push( timeout );
            }
            this.invoke( timeout.fn, timeout.bind );
        }
        this._scheduleTimeout();
        return this;
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
        this._timeouts.remove( token );
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
        Method: Function#nextLoop

        Returns:
            {Function} Returns wrapper that passes calls to
            <O.RunLoop.invokeInNextEventLoop>.
    */
    nextLoop: function () {
        var fn = this;
        return function () {
            RunLoop.invokeInNextEventLoop( fn, this );
            return this;
        };
    },

    /**
        Method: Function#nextFrame

        Returns:
            {Function} Returns wrapper that passes calls to
            <O.RunLoop.invokeInNextFrame>.
    */
    nextFrame: function () {
        var fn = this;
        return function () {
            RunLoop.invokeInNextFrame( fn, this );
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

var nextLoop = RunLoop.invoke.bind( RunLoop,
    RunLoop.flushQueue, RunLoop, [ 'nextLoop' ]
);
var processTimeouts = RunLoop.processTimeouts.bind( RunLoop );

var nextFrame = function ( time ) {
    RunLoop.frameStartTime = time;
    RunLoop.mayRedraw = true;
    RunLoop.invoke( RunLoop.flushQueue, RunLoop, [ 'nextFrame' ] );
    RunLoop.mayRedraw = false;
};

}( O, window, typeof setImmediate !== 'undefined' ?
    setImmediate :
    function ( fn ) {
        return setTimeout( fn, 0 );
    }
) );

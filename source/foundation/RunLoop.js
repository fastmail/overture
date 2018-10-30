/*global setTimeout, clearTimeout, console */

import Heap from './Heap';

const win = window;

const setImmediate = window.setImmediate || function ( fn ) {
        return setTimeout( fn, 0 );
    };

const requestAnimFrame =
    win.requestAnimationFrame       ||
    win.oRequestAnimationFrame      ||
    win.webkitRequestAnimationFrame ||
    win.mozRequestAnimationFrame    ||
    win.msRequestAnimationFrame     ||
    ( function () {
        let lastTime = 0;
        return function ( callback ) {
            const time = Date.now();
            const timeToNextCall = Math.max( 0, 16 - ( time - lastTime ) );
            lastTime = time;
            win.setTimeout( function () {
                callback( time + timeToNextCall );
            }, timeToNextCall );
        };
    }() );

const Timeout = function ( time, period, fn, bind ) {
    this.time = time;
    this.period = period;
    this.fn = fn;
    this.bind = bind;
};

const parentsBeforeChildren = function ( a, b ) {
    let aView = a[1];
    let bView = b[1];

    // Cheap test for ( x instanceof View )
    if ( !aView || !aView.parentView ) {
        aView = null;
    }
    if ( !bView || !bView.parentView ) {
        bView = null;
    }

    // If equal, order doesn't matter
    if ( aView === bView ) {
        return 0;
    }

    // Redraw views before bindings directly to DOM nodes; it may remove
    // the view from the DOM so the update is cheaper
    if ( !aView || !bView ) {
        return !aView ? 1 : -1;
    }

    // Redraw parents before children; it may remove the child so nullify
    // the need to redraw.
    let aDepth = 0;
    let bDepth = 0;
    while (( aView = aView.get( 'parentView' ) )) {
        aDepth += 1;
    }
    while (( bView = bView.get( 'parentView' ) )) {
        bDepth += 1;
    }
    return aDepth - bDepth;
};

/**
    Class: O.RunLoop

    The run loop allows data to propagate through the app in stages, preventing
    multiple changes to an object firing off the same observers several times.
    To use, wrap the entry point functions in a call to <O.RunLoop.invoke>.
*/

// eslint-disable-next-line prefer-const
let nextLoop;
// eslint-disable-next-line prefer-const
let processTimeouts;
// eslint-disable-next-line prefer-const
let nextFrame;
// (Because of a false positive. TODO(cmorgan): report this as a bug in eslint.)

const RunLoop = {

    mayRedraw: false,

    /**
        Property (private): O.RunLoop._queueOrder
        Type: String[]

        The order in which to flush the queues.
    */
    _queueOrder: [ 'before', 'bindings', 'middle', 'render', 'after' ],

    /**
        Property (private): O.RunLoop._queues
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
        nextFrame: [],
    },

    /**
        Property (private): O.RunLoop._timeouts
        Type: O.Heap

        A priority queue of timeouts.
    */
    _timeouts: new Heap( function ( a, b ) {
        return a.time - b.time;
    }),

    /**
        Property (private): O.RunLoop._nextTimeout
        Type: Number

        Epoch time that the next browser timeout is scheduled for.
    */
    _nextTimeout: 0,

    /**
        Property (private): O.RunLoop._timer
        Type: Number

        The browser timer id (response from setTimeout), which you need if
        you want to cancel the timeout.
    */
    _timer: null,

    /**
        Property (private): O.RunLoop._depth
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
    flushQueue ( queue ) {
        const toInvoke = this._queues[ queue ];
        const l = toInvoke.length;

        if ( l ) {
            this._queues[ queue ] = [];

            if ( queue === 'render' ) {
                toInvoke.sort( parentsBeforeChildren );
            }

            for ( let i = 0; i < l; i += 1 ) {
                const tuple = toInvoke[i];
                const fn = tuple[0];
                const bind = tuple[1];
                try {
                    if ( bind ) {
                        fn.call( bind );
                    } else {
                        fn();
                    }
                } catch ( error ) {
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
    flushAllQueues () {
        const order = this._queueOrder;
        const l = order.length;
        let i = 0;
        while ( i < l ) {
            // "Render" waits for next frame, except if in bg, since
            // animation frames don't fire while in the background and we want
            // to flush queues in a reasonable time, as they may redraw the tab
            // name, favicon etc.
            if ( !document.hidden && (
                    ( i === 3 && !this.mayRedraw ) ) ) {
                if ( !this._queues.nextFrame.length ) {
                    requestAnimFrame( nextFrame );
                }
                return;
            }
            if ( this.flushQueue( order[i] ) ) {
                i = 0;
            } else {
                i = i + 1;
            }
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
    queueFn ( queue, fn, bind, allowDups ) {
        const toInvoke = this._queues[ queue ];
        const l = toInvoke.length;
        // Log error here, as the stack trace is useless inside flushQueue.
        if ( !fn ) {
            try {
                fn();
            } catch ( error ) {
                RunLoop.didError( error );
            }
        } else {
            if ( !allowDups ) {
                for ( let i = 0; i < l; i += 1 ) {
                    const tuple = toInvoke[i];
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
            {*} The return value of the invoked function, or `undefined` if it
                throws an exception.
    */
    invoke ( fn, bind, args ) {
        let returnValue;
        this._depth += 1;
        try {
            // Avoiding apply/call when not needed is faster
            if ( args ) {
                returnValue = fn.apply( bind, args );
            } else if ( bind ) {
                returnValue = fn.call( bind );
            } else {
                returnValue = fn();
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
        return returnValue;
    },

    /**
        Method: O.RunLoop.invokeInNextEventLoop

        Use this to invoke a function in a new browser event loop, immediately
        after this event loop has finished.

        Parameters:
            fn   - {Function} The function to invoke.
            bind - {Object} (optional) The object to make the 'this' parameter
                   when the function is invoked.
            allowDups - {Boolean} (optional) If not true, will search queue to
                        check this fn/bind combination is not already present.

        Returns:
            {O.RunLoop} Returns self.
    */
    invokeInNextEventLoop ( fn, bind, allowDups ) {
        if ( !this._queues.nextLoop.length ) {
            setImmediate( nextLoop );
        }
        return this.queueFn( 'nextLoop', fn, bind, allowDups );
    },

    /**
        Method: O.RunLoop.invokeInNextFrame

        Use this to invoke a function just before the browser next redraws.

        Parameters:
            fn   - {Function} The function to invoke.
            bind - {Object} (optional) The object to make the 'this' parameter
                   when the function is invoked.
            allowDups - {Boolean} (optional) If not true, will search queue to
                        check this fn/bind combination is not already present.

        Returns:
            {O.RunLoop} Returns self.
    */
    invokeInNextFrame ( fn, bind, allowDups ) {
        if ( !this._queues.nextFrame.length ) {
            requestAnimFrame( nextFrame );
        }
        return this.queueFn( 'nextFrame', fn, bind, allowDups );
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
    invokeAfterDelay ( fn, delay, bind ) {
        const timeout = new Timeout( Date.now() + delay, 0, fn, bind );
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
    invokePeriodically ( fn, period, bind ) {
        const timeout = new Timeout( Date.now() + period, period, fn, bind );
        this._timeouts.push( timeout );
        this._scheduleTimeout();
        return timeout;
    },

    /**
        Method (private): O.RunLoop._scheduleTimeout

        Sets the browser timer if necessary to trigger at the time of the next
        timeout in the priority queue.
    */
    _scheduleTimeout () {
        const timeout = this._timeouts.peek();
        const time = timeout ? timeout.time : 0;
        if ( time && time !== this._nextTimeout ) {
            clearTimeout( this._timer );
            const delay = time - Date.now();
            if ( delay > 0 ) {
                this._timer = setTimeout( processTimeouts, time - Date.now() );
                this._nextTimeout = time;
            } else {
                this._nextTimeout = 0;
            }
        }
    },

    /**
        Method: O.RunLoop.processTimeouts

        Invokes all functions in the timeout queue that were scheduled to
        trigger on or before "now".

        Returns:
            {O.RunLoop} Returns self.
    */
    processTimeouts () {
        const timeouts = this._timeouts;
        while ( timeouts.length && timeouts.peek().time <= Date.now() ) {
            const timeout = timeouts.pop();
            let period;
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
    cancel ( token ) {
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
    didError ( error ) {
        if ( window.console ) {
            console.log( error.name, error.message, error.stack );
        }
    },
};

export default RunLoop;

Object.assign( Function.prototype, {
    /**
        Method: Function#queue

        Parameters:
            queue - {String} The name of the queue to add calls to this function
                    to.

        Returns:
            {Function} Returns wrapper that passes calls to
            <O.RunLoop.queueFn>.
    */
    queue ( queue ) {
        const fn = this;
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
    nextLoop () {
        const fn = this;
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
    nextFrame () {
        const fn = this;
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
    invokeInRunLoop () {
        const fn = this;
        return function () {
            return RunLoop.invoke( fn, this, arguments );
        };
    },
});

nextLoop = RunLoop.invoke.bind( RunLoop,
    RunLoop.flushQueue, RunLoop, [ 'nextLoop' ]
);
processTimeouts = RunLoop.processTimeouts.bind( RunLoop );

nextFrame = function ( time ) {
    RunLoop.frameStartTime = time;
    RunLoop.mayRedraw = true;
    RunLoop.invoke( RunLoop.flushQueue, RunLoop, [ 'nextFrame' ] );
    RunLoop.mayRedraw = false;
};

// TODO(cmorgan/modulify): do something about these exports: Function#queue,
// Function#nextLoop, Function#nextFrame, Function#invokeInRunLoop

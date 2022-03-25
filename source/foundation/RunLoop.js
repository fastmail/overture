/*global document, setTimeout, clearTimeout, requestAnimationFrame,
    console, window */

import { Heap } from './Heap.js';

const Timeout = function (time, period, fn, bind, doNotSchedule) {
    this.time = time;
    this.period = period;
    this.fn = fn;
    this.bind = bind;
    this.doNotSchedule = doNotSchedule || false;
};

const parentsBeforeChildren = function (a, b) {
    let aView = a[1];
    let bView = b[1];

    // Cheap test for ( x instanceof View )
    if (!aView || !aView.parentView) {
        aView = null;
    }
    if (!bView || !bView.parentView) {
        bView = null;
    }

    // If equal, order doesn't matter
    if (aView === bView) {
        return 0;
    }

    // Redraw views before bindings directly to DOM nodes; it may remove
    // the view from the DOM so the update is cheaper
    if (!aView || !bView) {
        return !aView ? 1 : -1;
    }

    // Redraw parents before children; it may remove the child so nullify
    // the need to redraw.
    let aDepth = 0;
    let bDepth = 0;
    while ((aView = aView.get('parentView'))) {
        aDepth += 1;
    }
    while ((bView = bView.get('parentView'))) {
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

let frameStartTime = 0;
let mayRedraw = false;

/**
    Property (private): O.RunLoop._queueOrder
    Type: String[]

    The order in which to flush the queues.
*/
const _queueOrder = ['before', 'bindings', 'middle', 'render', 'after'];

/**
    Property (private): O.RunLoop._queues
    Type: Object

    Collection of queues. Each queue contains [fn, bind] tuples to call at
    <O.RunLoop.end>.
*/
const _queues = {
    before: [],
    bindings: [],
    middle: [],
    render: [],
    after: [],
    nextLoop: [],
    nextFrame: [],
};

/**
    Property (private): O.RunLoop._timeouts
    Type: O.Heap

    A priority queue of timeouts.
*/
const _timeouts = new Heap((a, b) => {
    return a.time - b.time;
});

/**
    Property (private): O.RunLoop._nextTimeout
    Type: Number

    Epoch time that the next browser timeout is scheduled for.
*/
const MAX_SAFE_INTEGER = 9007199254740991;
let _nextTimeout = MAX_SAFE_INTEGER;

/**
    Property (private): O.RunLoop._timer
    Type: Number

    The browser timer id (response from setTimeout), which you need if
    you want to cancel the timeout.
*/
let _timer = null;

/**
    Property (private): O.RunLoop._depth
    Type: Number

    Number of calls to <O.RunLoop.invoke> currently in stack.
*/
let _depth = 0;

/**
    Method: O.RunLoop.flushQueue

    Invokes each function in an array of [function, object] tuples, binding
    the this parameter of the function to the object, and empties the array.

    Parameters:
        queue - {String} name of the queue to flush.

    Returns:
        {Boolean} Were any functions actually invoked?
*/
const flushQueue = function (queue) {
    const toInvoke = _queues[queue];
    const l = toInvoke.length;

    if (l) {
        _queues[queue] = [];

        if (queue === 'render') {
            toInvoke.sort(parentsBeforeChildren);
        }

        for (let i = 0; i < l; i += 1) {
            const tuple = toInvoke[i];
            const fn = tuple[0];
            const bind = tuple[1];
            try {
                if (bind) {
                    fn.call(bind);
                } else {
                    fn();
                }
            } catch (error) {
                didError(error);
            }
        }
        return true;
    }
    return false;
};

/**
    Method: O.RunLoop.flushAllQueues

    Calls O.RunLoop#flushQueue on each queue in the order specified in
    _queueOrder, starting at the first queue again whenever the queue
    indicates something has changed.
*/
const flushAllQueues = function () {
    const queues = _queues;
    const order = _queueOrder;
    const l = order.length;
    let i = 0;
    while (i < l) {
        const queueName = order[i];
        if (queues[queueName].length) {
            // "Render" waits for next frame, except if in bg, since
            // animation frames don't fire while in the background and we
            // want to flush queues in a reasonable time, as they may
            // redraw the tab name, favicon etc.
            if (i > 2 && !mayRedraw && !document.hidden) {
                if (!queues.nextFrame.length) {
                    requestAnimationFrame(nextFrame);
                }
                return;
            }
            flushQueue(queueName);
            i = 0;
        } else {
            i = i + 1;
        }
    }
};

/**
    Method: O.RunLoop.eraseAllQueues

    Drops all queued functions without running them.
*/
const eraseAllQueues = function () {
    for (const id in _queues) {
        _queues[id].length = 0;
    }
};

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
const queueFn = function (queue, fn, bind, allowDups) {
    const toInvoke = _queues[queue];
    const l = toInvoke.length;
    // Log error here, as the stack trace is useless inside flushQueue.
    if (!fn) {
        try {
            fn();
        } catch (error) {
            didError(error);
        }
    } else {
        if (!allowDups) {
            for (let i = 0; i < l; i += 1) {
                const tuple = toInvoke[i];
                if (tuple[0] === fn && tuple[1] === bind) {
                    return;
                }
            }
        }
        toInvoke[l] = [fn, bind];
    }
};

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
const invoke = function (fn, bind, args) {
    let returnValue;
    _depth += 1;
    try {
        // Avoiding apply/call when not needed is faster
        if (args) {
            returnValue = fn.apply(bind, args);
        } else if (bind) {
            returnValue = fn.call(bind);
        } else {
            returnValue = fn();
        }
    } catch (error) {
        didError(error);
    }
    if (_depth === 1) {
        flushAllQueues();
    }
    _depth -= 1;
    if (!_depth) {
        processTimeouts();
    }
    return returnValue;
};

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
const invokeInNextEventLoop = function (fn, bind, allowDups) {
    if (!_queues.nextLoop.length) {
        setTimeout(nextLoop, 0);
    }
    return queueFn('nextLoop', fn, bind, allowDups);
};

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
const invokeInNextFrame = function (fn, bind, allowDups) {
    if (!_queues.nextFrame.length) {
        requestAnimationFrame(nextFrame);
    }
    return queueFn('nextFrame', fn, bind, allowDups);
};

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
const invokeAfterDelay = function (fn, delay, bind, doNotSchedule) {
    const timeout = new Timeout(Date.now() + delay, 0, fn, bind, doNotSchedule);
    _timeouts.push(timeout);
    if (!doNotSchedule) {
        _scheduleTimeout(timeout);
    }
    return timeout;
};

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
const invokePeriodically = function (fn, period, bind, doNotSchedule) {
    const timeout = new Timeout(
        Date.now() + period,
        period,
        fn,
        bind,
        doNotSchedule,
    );
    _timeouts.push(timeout);
    if (!doNotSchedule) {
        _scheduleTimeout(timeout);
    }
    return timeout;
};

/**
    Method (private): O.RunLoop._scheduleTimeout

    Sets the browser timer if necessary to trigger at the time of the next
    timeout in the priority queue.
*/
const _scheduleTimeout = function (timeout) {
    const time = timeout.time;
    if (time < _nextTimeout) {
        clearTimeout(_timer);
        const delay = time - Date.now();
        if (delay > 0) {
            _timer = setTimeout(processTimeouts, delay);
            _nextTimeout = time;
        } else {
            // No need to set a timeout, it will be processed at the end of
            // this run loop.
            _nextTimeout = MAX_SAFE_INTEGER;
        }
    }
};

/**
    Method: O.RunLoop.processTimeouts

    Invokes all functions in the timeout queue that were scheduled to
    trigger on or before "now".

    Returns:
        {O.RunLoop} Returns self.
*/
const processTimeouts = function () {
    const timeouts = _timeouts;
    const now = Date.now();
    let nextToSchedule = null;
    while (timeouts.length) {
        const timeout = timeouts.peek();
        if (timeout.time > now) {
            nextToSchedule = timeout;
            break;
        }
        timeouts.pop();
        const period = timeout.period;
        if (period) {
            timeout.time = now + period;
            timeouts.push(timeout);
        }
        invoke(timeout.fn, timeout.bind);
    }
    if (nextToSchedule && nextToSchedule.time !== _nextTimeout) {
        _nextTimeout = MAX_SAFE_INTEGER;
        if (nextToSchedule.doNotSchedule) {
            nextToSchedule = null;
            timeouts.forEach((timeout) => {
                if (
                    !timeout.doNotSchedule &&
                    (!nextToSchedule || nextToSchedule.time > timeout.time)
                ) {
                    nextToSchedule = timeout;
                }
            });
        }
        if (nextToSchedule) {
            _scheduleTimeout(nextToSchedule);
        }
    }
};

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
const cancel = function (token) {
    _timeouts.remove(token);
};

/**
    Method: O.RunLoop.didError

    This method is invoked if an uncaught error is thrown in a run loop.
    Overwrite this method to do something more useful then just log the
    error to the console.

    Parameters:
        error - {Error} The error object.
*/
let didError = function (error) {
    if (window.console) {
        console.log(error.name, error.message, error.stack);
    }
};

/**
    Method: O.RunLoop.setDidError

    Overwrite the O.RunLoop.didError method to do something more useful then
    logging the error to the console.

    Parameters:
        fn - {Function} The new didError function.
*/
const setDidError = function (fn) {
    didError = fn;
};

const nextLoop = invoke.bind(null, flushQueue, null, ['nextLoop']);

const nextFrame = function (time) {
    frameStartTime = time;
    mayRedraw = true;
    invoke(flushQueue, null, ['nextFrame']);
    mayRedraw = false;
};

export {
    frameStartTime,
    mayRedraw,
    flushQueue,
    flushAllQueues,
    eraseAllQueues,
    queueFn,
    invoke,
    invokeInNextEventLoop,
    invokeInNextFrame,
    invokeAfterDelay,
    invokePeriodically,
    processTimeouts,
    cancel,
    didError,
    setDidError,
};

// -------------------------------------------------------------------------- \\
// File: RunLoop.js                                                           \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, setTimeout, clearTimeout, setInterval, clearInterval */

"use strict";

( function ( NS ) {
    
/**
    Class: O.RunLoop
    
    The run loop allows data to propagate through the app in stages, preventing
    multiple changes to an object firing off the same observers several times.
    To use, simply call <O.RunLoop.begin> at the beginning of any root event
    handler (i.e. one triggered by the browser itself, not synthetically) and
    <O.RunLoop.end> at the end.
*/

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
            NS.RunLoop.queueFn( queue, fn, this );
            return this;
        };
    }
});

NS.RunLoop = {
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
        setTimeout( function () {
            NS.RunLoop.begin();
            fn.call( bind );
            NS.RunLoop.end();
        }, 0 );
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
            NS.RunLoop.begin();
            fn.call( bind );
            NS.RunLoop.end();
        }, delay );
    },
    
    /**
        Method: O.RunLoop.invokePeriodically
        
        Use this to invoke a function periodically, with a set time between
        invocations.
        
        Parameters:
            fn    - {Function} The function to invoke periodically.
            delay - {Number} The period in milliseconds between invocations.
            bind  - {Object} (optional) The object to make the 'this' parameter
                    when the function is invoked.
        
        Returns:
            {InvocationToken} Returns a token that can be passed to the
            <O.RunLoop.cancel> method to cancel all future invocations scheduled
            by this call.
    */
    invokePeriodically: function ( fn, period, bind ) {
        return setInterval( function () {
            NS.RunLoop.begin();
            fn.call( bind );
            NS.RunLoop.end();
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
        Property (private): NS.RunLoop._queueOrder
        Type: Array.<String>
        
        The order in which to flush the queues.
    */
    _queueOrder: [ 'before', 'bindings', 'after' ],
    
    /**
        Property (private): NS.RunLoop._queues
        Type: Object
        
        Collection of queues. Each queue contains [fn, bind] tuples to call at
        <O.RunLoop.end>.
    */
    _queues: {
        before: [],
        bindings: [],
        after: []
    },
    
    /**
        Property (private): NS.RunLoop._depth
        Type: Number
        
        Number of calls to <O.RunLoop.begin> without a matching call to
        <O.RunLoop.end>.
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
                tuple[0].call( tuple[1] );
            }
            return true;
        }
        return false;
    },
    
    /**
        Method: O.RunLoop.queueFn
        
        Add a [function, object] tuple to a queue, ensuring it is not added
        again if it is already there.
        
        Parameters:
            queue - {String} The name of the queue to add the tuple to.
            fn    - {Function} The function to add to the array.
            bind  - {(Object|undefined)} The object the function will be bound
                    to when called.
        
        Returns:
            {O.RunLoop} Returns self.
    */
    queueFn: function ( queue, fn, bind ) {
        var toInvoke = this._queues[ queue ],
            i, l, tuple;
        for ( i = 0, l = toInvoke.length; i < l; i += 1 ) {
            tuple = toInvoke[i];
            if ( tuple[0] === fn && tuple[1] === bind ) {
                return this;
            }
        }
        toInvoke[l] = [ fn, bind ];
        return this;
    },
    
    /**
        Method: O.RunLoop.begin
        
        Start a run loop.
        
        Returns:
            {O.RunLoop} Returns self.
    */
    begin: function () {
        this._depth += 1;
        return this;
    },
    
    /**
        Method: O.RunLoop.begin
        
        End a run loop. Flushes the queues if all nested calls to begin have now
        been ended.
        
        Returns:
            {O.RunLoop} Returns self.
    */
    end: function () {
        if ( this._depth === 1 ) {
            var order = this._queueOrder,
                i = 0, l = order.length;
            while ( i < l ) {
                i = this.flushQueue( order[i] ) ? 0 : i + 1;
            }
        }
        this._depth -= 1;
        return this;
    }
};

}( O ) );
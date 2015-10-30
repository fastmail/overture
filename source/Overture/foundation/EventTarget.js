// -------------------------------------------------------------------------- \\
// File: EventTarget.js                                                       \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var meta = NS.meta,
    slice = Array.prototype.slice,
    eventPrefix = '__event__';

Function.implement({
    /**
        Method: Function#on

        Defines the list of events this method is interested in. Whenever one of
        these events is triggered on the object to which this method belongs,
        the method will automatically be called.

        Parameters:
            var_args - {...String} All arguments are treated as the names of
                       events this method should be triggered by.

        Returns:
            {Function} Returns self.
     */
    on: function () {
        return this.observes.apply( this,
            slice.call( arguments ).map( function ( type ) {
                return eventPrefix + type;
            })
        );
    }
});

/**
    Class: O.Event

    Represents a synthetic event.
*/
var Event = NS.Class({

    /**
        Constructor: O.Event

        Parameters:
            type   - {String} The event type.
            target - {Object} The target on which the event is to fire.
            mixin  - {Object} (optional) Any further properties to add to the
                     event.
    */
    init: function ( type, target, mixin ) {
        this.type = type;
        this.target = target;
        this.defaultPrevented = false;
        this.propagationStopped = false;
        NS.extend( this, mixin );
    },

    /**
        Method: O.Event#preventDefault

        Prevent the default action for this event (if any).

        Returns:
            {O.Event} Returns self.
    */
    preventDefault: function () {
        this.defaultPrevented = true;
        return this;
    },

    /**
        Method: O.Event#stopPropagation

        Stop bubbling the event up to the next target.

        Returns:
            {O.Event} Returns self.
    */
    stopPropagation: function () {
        this.propagationStopped = true;
        return this;
    }
});

NS.Event = Event;

/**
    Mixin: O.EventTarget

    The EventTarget mixin allows you to add custom event support to any other
    class complete with support for bubbling. Simply add a `Mixin:
    O.EventTarget` property to your class. Then you can fire an event at any
    time by calling `this.fire('eventName')`. If you add a target to support
    bubbling, it is recommended you add a prefix to the name of your events, to
    distinguish them from those of other classes, e.g. the IO class fires
    `io:eventName` events.
*/
NS.EventTarget = {

    /**
        Property: O.EventTarget#nextEventTarget
        Type: (O.EventTarget|null)

        Pointer to the next object in the event bubbling chain.
    */
    nextEventTarget: null,

    /**
        Method: O.EventTarget#on

        Add a function to be called whenever an event of a particular type is
        fired.

        Parameters:
            type   - {String} The name of the event to subscribe to.
            obj    - {(Function|Object)} The function to be called when the
                     event fires, or alternatively supply an object and in the
                     third parameter give the name of the method to be called on
                     it.
            method - {String} (optional) The name of the callback method to be
                     called on obj. Ignored if a function is passed for the 2nd
                     parameter.

        Returns:
            {O.EventTarget} Returns self.
    */
    on: function ( type, obj, method ) {
        if ( !( obj instanceof Function ) ) {
            obj = { object: obj, method: method };
        }
        type = eventPrefix + type;

        var observers = meta( this ).observers,
            handlers = observers[ type ];
        if ( !observers.hasOwnProperty( type ) ) {
            handlers = observers[ type ] = handlers ?
                handlers.slice() : [];
        }
        handlers.push( obj );
        return this;
    },

    /**
        Method: O.EventTarget#once

        Add a function to be called the next time an event of a particular type
        is fired, but not for subsequent firings.

        Parameters:
            type - {String} The name of the event to subscribe to.
            fn   - {Function} The function to be called when the event fires.

        Returns:
            {O.EventTarget} Returns self.
    */
    once: function ( type, fn ) {
        var once = function ( event ) {
            fn.call( this, event );
            this.off( type, once );
        };
        this.on( type, once );
        return this;
    },

    /**
        Method: O.EventTarget#fire

        Fires an event, causing all subscribed functions to be called with an
        event object as the single parameter and the scope bound to the object
        on which they subscribed to the event. In the case of subscribed
        object/method name pairs, the scope will remain the object on which the
        method is called.

        The event object contains the properties supplied in the details
        parameter and also a type attribute, with the type of the event, a
        target attribute, referencing the object on which the event was actually
        fired, a preventDefault function, which stops the default function
        firing if supplied, and a stopPropagation function, which prevents the
        event bubbling any further.

        Parameters:
            type  - {String} The name of the event being fired.
            event - {Event|O.Event|Object} (optional) An event object or object
                    of values to be added to the event object.

        Returns:
            {O.EventTarget} Returns self.
    */
    fire: function ( type, event ) {
        var target = this,
            typeKey = eventPrefix + type,
            handler, handlers, length;

        if ( !event || !( event instanceof Event ) ) {
            if ( event && /Event\]$/.test( event.toString() ) ) {
                event.stopPropagation = function () {
                    this.propagationStopped = true;
                    return this;
                };
            } else {
                event = new Event( type, target, event );
            }
        }
        event.propagationStopped = false;

        while ( target ) {
            handlers = meta( target ).observers[ typeKey ];
            length = handlers ? handlers.length : 0;
            while ( length-- ) {
                try {
                    handler = handlers[ length ];
                    if ( handler instanceof Function ) {
                        handler.call( target, event );
                    } else {
                        ( handler.object || target )[ handler.method ]( event );
                    }
                } catch ( error ) {
                    NS.RunLoop.didError( error );
                }
            }
            // Move up the hierarchy, unless stopPropagation was called
            target =
                event.propagationStopped ?
                    null :
                target.get ?
                    target.get( 'nextEventTarget' ) :
                    target.nextEventTarget;
        }

        return this;
    },

    /**
        Method: O.EventTarget#off

        Detaches a particular event handler or all handlers for a particular
        event type. This method has no effect if the function supplied is not
        subscribed to the event type given, or no function is supplied and the
        event type given has no handlers subscribed.

        Parameters:
            type   - {String} The name of the event to detach handlers from.
            obj    - {(Function|Object)} (optional) The function to detach or
                     the obj whose method will be detached. If this argument is
                     not supplied, all handlers for the given type will be
                     removed.
            method - {String} (optional) The name of the callback method to be
                     detached. Ignored if a function is passed for the 2nd
                     parameter.

        Returns:
            {O.EventTarget} Returns self.
    */
    off: function ( type, obj, method ) {
        type = eventPrefix + type;

        var observers = meta( this ).observers,
            handlers = observers[ type ];
        if ( handlers ) {
            if ( !observers.hasOwnProperty( type ) ) {
                handlers = observers[ type ] = handlers.slice();
            }
            if ( obj ) {
                if ( !( obj instanceof Function ) ) {
                    var l = handlers.length;
                    while ( l-- ) {
                        var handler = handlers[l];
                        if ( handler.object === obj &&
                                handler.method === method ) {
                            handlers.splice( l, 1 );
                        }
                    }
                } else {
                    handlers.erase( obj );
                }
            } else {
                handlers.length = 0;
            }
        }
        return this;
    }
};

}( O ) );

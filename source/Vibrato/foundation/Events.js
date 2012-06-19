// -------------------------------------------------------------------------- \\
// File: Events.js                                                            \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var meta = NS.meta,
    map = Array.prototype.map,
    eventPrefix = '__event__',
    toString = Object.prototype.toString;

Function.implement({
    /**
        Method: Function#on
        
        Defines the list of events this event is interested in. Whenever one of
        these events is triggered, the method will automatically be called.
        
        Parameters:
            var_args - {...String} All arguments are treated as the names of
                       events this method should be triggered by.
        
        Returns:
            {Function} Returns self.
     */
    on: function () {
        return this.observes.apply( this, map.call( arguments, function ( type ) {
            return eventPrefix + type;
        }) );
    }
});

/**
    Mixin: O.Events
    
    The Events mixin allows you to add custom event support to any other class
    complete with support for bubbling. Simply add a `Mixin: O.Events` property
    to your class. Then you can fire any event at any time just by calling
    `this.fire('eventName')`. If you add a target to support bubbling, it is
    recommended you add a prefix to the name of your events, to distinguish them
    from those of other classes, e.g. the IO class fires `io:eventName` events.
*/
NS.Events = {
    
    /**
        Property: O.Events#nextEventTarget
        Type: (O.Events|null)
        
        Pointer to the next object in the event bubbling chain.
    */
    nextEventTarget: null,
    
    /**
        Method: O.Events#on
        
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
            {O.Events} Returns self.
    */
    on: function ( type, obj, method ) {
        if ( !( obj instanceof Function ) ) {
            obj = { object: obj, method: method };
        }
        type = eventPrefix + type;
        
        var observers = meta( this, false ).observers,
            handlers = observers[ type ];
        if ( !observers.hasOwnProperty( type ) ) {
            handlers = observers[ type ] = handlers ?
                handlers.slice() : [];
        }
        handlers.push( obj );
        return this;
    },
    
    /**
        Method: O.Events#once
        
        Add a function to be called the next time an event of a particular type
        is fired, but not for subsequent firings.
        
        Parameters:
            type - {String} The name of the event to subscribe to.
            fn   - {Function} The function to be called when the event fires.
        
        Returns:
            {O.Events} Returns self.
    */
    once: function ( type, fn ) {
        var once = function ( event ) {
            fn.call( this, event );
            this.detach( type, once );
        };
        this.on( type, once );
        return this;
    },
    
    /**
        Method: O.Events#fire
        
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
            type      - {String} The name of the event being fired.
            event     - {Object} (optional) An event object or object of values
                        to be added to the event object.
            defaultFn - {Function} (optional) This function is called after all
                        event handlers have completed, providing none of them
                        called the preventDefault method on the event object.
        
        Returns:
            {Boolean} Was propagation stopped?
    */
    fire: function ( type, event, defaultFn ) {
        var canBubble = true,
            preventDefault = false,
            target = this,
            typeKey = eventPrefix + type,
            handler, handlers, length;
        
        if ( !( event && ( /Event\]$/.test( toString.call( event ) ) ||
                event.isEvent ) ) ) {
            event = NS.extend({
                type: type,
                target: this,
                preventDefault: function () {
                    preventDefault = true;
                    return this;
                }
            }, event );
        }
        
        event.stopPropagation = function () {
            canBubble = false;
            return this;
        };
        
        while ( target ) {
            handlers = meta( target, true ).observers[ typeKey ];
            length = handlers ? handlers.length : 0;
            while ( length-- ) {
                handler = handlers[ length ];
                if ( handler instanceof Function ) {
                    handler.call( target, event );
                } else {
                    ( handler.object || target )[ handler.method ]( event );
                }
            }
            // Did someone cancel the bubble
            if ( !canBubble ) { break; }
            // If not, move up the hierarchy
            target = target.get ?
                target.get( 'nextEventTarget' ) :
                target.nextEventTarget;
        }
        // When we get to the top, execute default.
        if ( defaultFn && !preventDefault ) {
            defaultFn( event );
        }
        return !canBubble;
    },
    
    /**
        Method: O.Events#detach
        
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
            {O.Events} Returns self.
    */
    detach: function ( type, obj, method ) {
        type = eventPrefix + type;
        
        var observers = meta( this, false ).observers,
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

}( this.O ) );
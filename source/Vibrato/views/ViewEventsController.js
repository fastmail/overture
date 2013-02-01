// -------------------------------------------------------------------------- \\
// File: ViewEventsController.js                                              \\
// Module: View                                                               \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Object: O.ViewEventsController

    Most DOM events are handled via delegation. When an event occurs, it is
    passed to the O.ViewEventsController. This maintains a list of event
    targets that should receive the event before the view handles it, and a list
    of targets that should receive it after it has traversed the view hierarchy.

    When an event is dispatched, it passes through all targets in the first
    list, then is dispatched at the view which owns the node on which the event
    occurred (and will bubble up the view tree from there), then passes through
    all the targets that are queued to handle it after the view. Any event
    handler may call `event.stopPropagation()`, which will stop the view from
    passing to any further targets.

*/
var ViewEventsController = {

    /**
        Property (private): O.ViewEventsController._activeViews
        Type: Object

        Maps from id to the view object for all views currently in a document.
    */
    _activeViews: {},

    /**
        Method: O.ViewEventsController.registerActiveView

        Automatically called when a view is inserted into a document. Adds an
        internal id -> <O.View> mapping.

        Parameters:
            view - {O.View} The view object that has entered the document.

        Returns:
            {O.ViewEventsController} Returns self.
    */
    registerActiveView: function ( view ) {
        this._activeViews[ view.get( 'id' ) ] = view;
        return this;
    },

    /**
        Method: O.ViewEventsController.deregisterActiveView

        Automatically called when a view is removed from a document. Removes an
        internal id -> <O.View> mapping.

        Parameters:
            view - {O.View} The view object that has left the document.

        Returns:
            {O.ViewEventsController} Returns self.
    */
    deregisterActiveView: function ( view ) {
        delete this._activeViews[ view.get( 'id' ) ];
        return this;
    },

    /**
        Method: O.ViewEventsController.getViewFromNode

        Returns the view object that the given DOM node is a part of.

        Parameters:
            node - {Element} a DOM node.

        Returns:
            {O.View|null} The view which owns the node.
    */
    getViewFromNode: function ( node ) {
        var activeViews = this._activeViews,
            doc = node.ownerDocument,
            view = null;
        while ( !view && node && node !== doc ) {
            view = activeViews[ node.id ];
            node = node.parentNode;
        }
        return view;
    },

    /**
        Property (private): O.ViewEventsController._eventTargets
        Type: Array.<O.EventTarget>

        List of event targets to dispatch events to.
    */
    _eventTargets: [],

    /**
        Method: O.ViewEventsController.pushEventTarget

        Adds an event target to the head of the queue. It will be the first to
        receive any future events (unless future calls to pushEventTarget add a
        new target ahead of it in the queue), and will always intercept an event
        before it reaches the view hierarchy.

        Parameters:
            eventTarget - {O.EventTarget} The event target to add to the head of
                          the queue.

        Returns:
            {O.ViewEventsController} Returns self.
    */
    pushEventTarget: function ( eventTarget ) {
        this._eventTargets.push( eventTarget );
        return this;
    },

    /**
        Method: O.ViewEventsController.queueEventTarget

        Adds an event target to the back of the queue. It will be the last to
        receive any future events (unless future calls to queueEventTarget add a
        new target behind it in the queue), and will only receive an event after
        it has traversed the full view hierarchy without
        `event.stopPropagation()` being called.

        Parameters:
            eventTarget - {O.EventTarget} The event target to add to the back of
                          the queue.

        Returns:
            {O.ViewEventsController} Returns self.
    */
    queueEventTarget: function ( eventTarget ) {
        this._eventTargets.unshift( eventTarget );
        return this;
    },

    /**
        Method: O.ViewEventsController.removeEventTarget

        Removes an event target from the queue that was previously added via
        <O.ViewEventsController.pushEventTarget> or
        <O.ViewEventsController.queueEventTarget>.

        Parameters:
            eventTarget - {O.EventTarget} The event target to remove from the
                          queue.

        Returns:
            {O.ViewEventsController} Returns self.
    */
    removeEventTarget: function ( eventTarget ) {
        this._eventTargets.erase( eventTarget );
        return this;
    },

    /**
        Method: O.ViewEventsController.handleEvent

        Dispatches an event to each of the targets registered with the
        controller, until it reaches the end of the list or one of them calls
        `event.stopPropagation()`.

        Parameters:
            event - {Event} The event object to dispatch.
            view  - {O.View} (optional) The view at which the event originated.
                    This is the view the event will be fired upon after it has
                    been through all the pushed targets. If not supplied, the
                    view will be looked up via the DOM node in the
                    `event.target` property.
    */
    handleEvent: function ( event, view ) {
        var eventTargets = this._eventTargets,
            l = eventTargets.length,
            eventTarget;

        if ( !view ) {
            view = this.getViewFromNode( event.target );
        }
        event.targetView = view;
        event.phase = 'beforeViews';

        while ( l-- ) {
            eventTarget = eventTargets[l];
            if ( eventTarget === this ) {
                eventTarget = view;
                event.phase = 'views';
            }
            if ( eventTarget && eventTarget.fire( event.type, event ) ) {
                break;
            }
            if ( eventTargets[l] === this ) {
                event.phase = 'afterViews';
            }
        }
    }.invokeInRunLoop()
};
ViewEventsController.pushEventTarget( ViewEventsController );

NS.ViewEventsController = ViewEventsController;

}( this.O ) );

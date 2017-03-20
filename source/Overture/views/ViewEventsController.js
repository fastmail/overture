import '../foundation/RunLoop.js';  // For Function#invokeInRunLoop
import '../foundation/Enumerable.js';  // For Array#binarySearch

const etSearch = function ( candidate, b ) {
    const a = candidate[0];
    return a < b ? -1 : a > b ? 1 : 0;
};

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

    Standard event target priorities used in library:

    40  - MouseEventRemover
    30  - GestureManager
    20  - DragController
    10  - ModalViewHandler
    -10 - GlobalKeyboardShortcuts

*/
const ViewEventsController = {

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
        const activeViews = this._activeViews;
        const doc = node.ownerDocument;
        let view = null;
        while ( !view && node && node !== doc ) {
            view = activeViews[ node.id ];
            node = node.parentNode;
        }
        return view;
    },

    /**
        Property (private): O.ViewEventsController._eventTargets
        Type: [Number,O.EventTarget][]

        List of event targets to dispatch events to.
    */
    _eventTargets: [],

    /**
        Method: O.ViewEventsController.addEventTarget

        Adds an event target to queue to receive view events. The position in
        the queue is determined by the priority argument:

        * Greater than 0 => before the view hierarchy receives the event.
        * Less than 0 => after the view hierarchy receives the event.

        If an existing target in the queue has the same priority as the new one,
        the new one will be inserted such that it fires before the old one.

        Parameters:
            eventTarget - {O.EventTarget} The event target to add.
            priority    - {Number} The priority of the event target.

        Returns:
            {O.ViewEventsController} Returns self.
    */
    addEventTarget: function ( eventTarget, priority ) {
        if ( !priority ) { priority = 0; }
        const eventTargets = this._eventTargets.slice();
        let index = eventTargets.binarySearch( priority, etSearch );
        const length = eventTargets.length;

        while ( index < length && eventTargets[ index ][0] === priority ) {
            index += 1;
        }

        eventTargets.splice( index, 0, [ priority, eventTarget ] );
        this._eventTargets = eventTargets;

        return this;
    },

    /**
        Method: O.ViewEventsController.removeEventTarget

        Removes an event target from the queue that was previously added via
        <O.ViewEventsController.addEventTarget>.

        Parameters:
            eventTarget - {O.EventTarget} The event target to remove from the
                          queue.

        Returns:
            {O.ViewEventsController} Returns self.
    */
    removeEventTarget: function ( eventTarget ) {
        this._eventTargets = this._eventTargets.filter( function ( target ) {
            return target[1] !== eventTarget;
        });
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
    handleEvent: function ( event, view, _rootView ) {
        const eventTargets = this._eventTargets;
        let l = eventTargets.length;

        if ( !view ) {
            view = this.getViewFromNode( event.target ) || _rootView;
        }
        event.targetView = view;

        while ( l-- ) {
            let eventTarget = eventTargets[l][1];
            if ( eventTarget === this ) {
                eventTarget = view;
            }
            if ( eventTarget ) {
                eventTarget.fire( event.type, event );
                if ( event.propagationStopped ) {
                    break;
                }
            }
        }
    }.invokeInRunLoop(),
};
ViewEventsController.addEventTarget( ViewEventsController, 0 );

export default ViewEventsController;

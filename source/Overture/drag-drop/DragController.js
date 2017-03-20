// -------------------------------------------------------------------------- \\
// File: DragController.js                                                    \\
// Module: DragDrop                                                           \\
// Requires: Foundation, DOM, View, Drag.js, DragEffect.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global document */

import Object from '../foundation/Object.js';
import '../foundation/EventTarget.js';  // For Function#on
import '../foundation/RunLoop.js';  // For Function#invokeInRunLoop
import DOMEvent from '../dom/DOMEvent.js';
import ViewEventsController from '../views/ViewEventsController.js';

import Drag from './Drag.js';  // Circular but it's OK
import DragEffect from './DragEffect.js';

var isControl = {
    BUTTON: 1,
    INPUT: 1,
    OPTION: 1,
    SELECT: 1,
    TEXTAREA: 1,
};
var effectToString = DragEffect.effectToString;
var DEFAULT = DragEffect.DEFAULT;

function TouchDragEvent ( touch ) {
    var clientX = touch.clientX,
        clientY = touch.clientY,
        target = document.elementFromPoint( clientX, clientY ) || touch.target;
    this.touch = touch;
    this.clientX = clientX;
    this.clientY = clientY;
    this.target = target;
    this.targetView = ViewEventsController.getViewFromNode( target );
}

var getTouch = function ( touches, touchId ) {
    var l = touches.length,
        touch;
    // Touch id may be 0 on Android chrome; can't use a falsy check
    if ( touchId === null ) {
        return null;
    }
    while ( l-- ) {
        touch = touches[l];
        if ( touch.identifier === touchId ) {
            return touch;
        }
    }
    return null;
};

/**
    Class: O.DragController

    This singleton manages drag and drop events, normalising native drag and
    drop with mouse(down|move|up) simulated drag and drop. It creates instances
    of <O.Drag> and dispatches events to them as necessary.

    It is unlikely that an application need interface with this object directly.
    The <O.Draggable>, <O.DragDataSource> and <O.DropTarget> mixins are used to
    add the required properties to views, and an instance of <O.Drag> gives all
    the information about the drag.
*/
var DragController = new Object({
    /**
        Property (private): O.DragController._x
        Type: Number

        The (screen-based) x coordinate of the mouse when the last mousedown
        event fired. Used to detect if the mouse has moved sufficiently whilst
        down to initiate a drag.
    */
    _x: 0,

    /**
        Property (private): O.DragController._y
        Type: Number

        The (screen-based) y coordinate of the mouse when the last mousedown
        event fired. Used to detect if the mouse has moved sufficiently whilst
        down to initiate a drag.
    */
    _y: 0,

    /**
        Property (private): O.DragController._targetView
        Type: O.View|null

        The <O.View> instance on which the mousedown event occurred. Used to
        determine the target view to trigger a simulated drag event.
    */
    _targetView: null,

    /**
        Property (private): O.DragController._ignore
        Type: Boolean

        If true, drag events will not be initiated on mousemove. Is set to true
        whilst the mouse is down (unless it was inside a control), until the
        mouse is up again or a drag is initiated.
    */
    _ignore: true,

    /**
        Property (private): O.DragController._touchId
        Type: String|null

        If a touch-inited drag is in progress, this holds the identifier of the
        touch being tracked
    */
    _touchId: null,

    /**
        Property (private): O.DragController._drag
        Type: O.Drag|null

        If a drag is in progress, this holds the current <O.Drag> instance.
    */
    _drag: null,

    /**
        Method: O.DragController.register

        Called by a new O.Drag instance when it is created to set it as the
        handler for all future drag events. Ends any previous drag if still
        active.

        Parameters:
            drag - {O.Drag} The new drag instance.
    */
    register: function ( drag ) {
        if ( this._drag ) {
            this._drag.endDrag();
        }
        this._drag = drag;
    },

    /**
        Method: O.DragController.deregister

        Called by a new O.Drag instance when it is finished to deregister from
        future drag events.

        Parameters:
            drag - {O.Drag} The finished drag instance.
    */
    deregister: function ( drag ) {
        if ( this._drag === drag ) {
            this._drag = null;
            this._touchId = null;
        }
    },

    /**
        Method: O.DragController.getNearestDragView

        Parameters:
            view - {O.View}

        Returns:
            {O.View|null} The view passed in or the nearest parent view of that
            (going up the tree) which is draggable. A view is draggable if it
            includes the <O.Draggable> mixin.
    */
    getNearestDragView: function ( view ) {
        while ( view ) {
            if ( view.get( 'isDraggable' ) ) {
                break;
            }
            view = view.get( 'parentView' ) || null;
        }
        return view;
    },

    /**
        Method: O.DragController.handleEvent

        Handler for native events. Fires an equivalent <O.EventTarget> event.

        Parameters:
            event - {Event}
    */
    handleEvent: function ( event ) {
        this.fire( event.type, event );
    }.invokeInRunLoop(),

    // === Non-native mouse API version ===

    /**
        Method (private): O.DragController._onMousedown

        Tracks mousedown events so that simulated drag events can be dispatched
        when a drag gesture is detected.

        Parameters:
            event - {Event} The mousedown event.
    */
    _onMousedown: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) { return; }
        if ( isControl[ event.target.nodeName ] ) {
            this._ignore = true;
        } else {
            this._x = event.clientX;
            this._y = event.clientY;
            this._targetView = event.targetView;
            this._ignore = false;
        }
    }.on( 'mousedown' ),

    /**
        Method (private): O.DragController._onMousemove

        Tracks mousemove events and creates a new <O.Drag> instance if a drag
        gesture is detected, or passes the move event to an existing drag.

        Parameters:
            event - {Event} The mousemove event.
    */
    _onMousemove: function ( event ) {
        var drag = this._drag;
        if ( drag && this._touchId === null ) {
            // Mousemove should only be fired if not native DnD, but sometimes
            // is fired even when there's a native drag
            if ( !drag.get( 'isNative' ) ) {
                drag.move( event );
            }
            // If mousemove during drag, don't propagate to views (for
            // consistency with native DnD).
            event.stopPropagation();
        } else if ( !this._ignore ) {
            var x = event.clientX - this._x,
                y = event.clientY - this._y,
                view;

            if ( ( x*x + y*y ) > 25 ) {
                view = this.getNearestDragView( this._targetView );
                if ( view ) {
                    new Drag({
                        dragSource: view,
                        event: event,
                        startPosition: {
                            x: this._x,
                            y: this._y,
                        },
                    });
                }
                this._ignore = true;
            }
        }
    }.on( 'mousemove' ),

    /**
        Method (private): O.DragController._onMouseup

        Tracks mouseup events to end simulated drags.

        Parameters:
            event - {Event} The mouseup event.
    */
    _onMouseup: function ( event ) {
        this._ignore = true;
        this._targetView = null;
        // Mouseup will not fire if native DnD
        var drag = this._drag;
        if ( drag && this._touchId === null ) {
            drag.drop( event ).endDrag();
        }
    }.on( 'mouseup' ),

    // === Non-native touch API version ===

    /**
        Method (private): O.DragController._onHold

        Parameters:
            event - {Event} The hold event.
    */
    _onHold: function ( event ) {
        var touch = event.touch,
            touchEvent = new TouchDragEvent( touch ),
            view = this.getNearestDragView( touchEvent.targetView );
        if ( view && !isControl[ touchEvent.target.nodeName ] ) {
            this._drag = new Drag({
                dragSource: view,
                event: touchEvent,
            });
            this._touchId = touch.identifier;
        }
    }.on( 'hold' ),

    /**
        Method (private): O.DragController._onTouchstart

        Parameters:
            event - {Event} The touchstart event.
    */
    // Just doing a sanity check to make sure our drag touch isn't orphaned
    _onTouchstart: function ( event ) {
        // Touch id may be 0 on Android chrome; can't use a falsy check
        if ( this._touchId !== null ) {
            var touch = getTouch( event.touches, this._touchId );
            if ( !touch ) {
                this._drag.endDrag();
            }
        }
    }.on( 'touchstart' ),

    /**
        Method (private): O.DragController._onTouchmove

        Parameters:
            event - {Event} The touchmove event.
    */
    _onTouchmove: function ( event ) {
        var touch = getTouch( event.changedTouches, this._touchId );
        if ( touch ) {
            this._drag.move( new TouchDragEvent( touch ) );
            // Don't propagate to views and don't trigger scroll.
            event.preventDefault();
            event.stopPropagation();
        }
    }.on( 'touchmove' ),

    /**
        Method (private): O.DragController._onTouchend

        Parameters:
            event - {Event} The touchend event.
    */
    _onTouchend: function ( event ) {
        var touch = getTouch( event.changedTouches, this._touchId );
        if ( touch ) {
            this._drag.drop( new TouchDragEvent( touch ) ).endDrag();
        }
    }.on( 'touchend' ),

    /**
        Method (private): O.DragController._onTouchcancel

        Parameters:
            event - {Event} The touchcancel event.
    */
    _onTouchcancel: function ( event ) {
        var touch = getTouch( event.changedTouches, this._touchId );
        if ( touch ) {
            this._drag.endDrag();
        }
    }.on( 'touchcancel' ),

    // === Native API version ===

    /**
        Method (private): O.DragController._onDragstart

        Tracks dragstart events to create a new <O.Drag> instance.

        Parameters:
            event - {Event} The dragstart event.
    */
    _onDragstart: function ( event ) {
        // We'll do our own drag system for anything implementing O.Draggable
        // Only allow native drag events for anything else (e.g. links and
        // anything marked with a draggable="true" attribute).
        var dragView = this.getNearestDragView( event.targetView );
        if ( dragView ) {
            event.preventDefault();
        } else {
            new Drag({
                event: event,
                isNative: true,
            });
        }
    }.on( 'dragstart' ),

    /**
        Method (private): O.DragController._onDragover

        Tracks dragover events to pass mouse movement to the <O.Drag> instance.

        Parameters:
            event - {Event} The dragover event.
    */
    _onDragover: function ( event ) {
        var drag = this._drag,
            dataTransfer = event.dataTransfer,
            notify = true,
            dropEffect, effectAllowed;
        // Probably hasn't come via root view controller, so doesn't have target
        // view property
        if ( !event.targetView ) {
            event.targetView =
                ViewEventsController.getViewFromNode( event.target );
        }
        if ( !drag ) {
            // IE10 will throw an error when you try to access this property!
            try {
                effectAllowed = dataTransfer.effectAllowed;
            } catch ( error ) {
                effectAllowed = DragEffect.ALL;
            }
            // Drag from external source
            drag = new Drag({
                event: event,
                isNative: true,
                allowedEffects: effectToString.indexOf( effectAllowed ),
            });
        } else {
            var x = event.clientX,
                y = event.clientY;
            if ( this._x === x && this._y === y ) {
                notify = false;
            } else {
                this._x = x;
                this._y = y;
            }
        }
        if ( notify ) {
            drag.move( event );
        }
        dropEffect = drag.get( 'dropEffect' );
        if ( dropEffect !== DEFAULT ) {
            dataTransfer.dropEffect =
                effectToString[ dropEffect & drag.get( 'allowedEffects' ) ];
            event.preventDefault();
        }
    }.on( 'dragover' ),

    /**
        Property (private): O.DragController._nativeRefCount
        Type: Number

        A reference count, incremented each time we see a dragenter event and
        decremented each time we see a dragleave event.

        If a native drag starts outside the window, we never get a dragend
        event. Instead we need to keep track of the dragenter/dragleave calls.
        The drag enter event is fired before the drag leave event (see
        http://dev.w3.org/html5/spec/dnd.html#drag-and-drop-processing-model),
        so when the count gets down to zero it means the mouse has left the
        actual window and so we can end the drag.
    */
    _nativeRefCount: 0,

    /**
        Method (private): O.DragController._onDragenter

        Tracks dragenter events to increment the
        <O.DragController._nativeRefCount> refcount.

        Parameters:
            event - {Event} The dragenter event.
    */
    _onDragenter: function (/* event */) {
        this._nativeRefCount += 1;
    }.on( 'dragenter' ),

    /**
        Method (private): O.DragController._onDragleave

        Tracks dragleave events to decrement the
        <O.DragController._nativeRefCount> refcount, and end the drag if it gets
        down to 0 (as this means the drag has left the browser window).

        Parameters:
            event - {Event} The dragleave event.
    */
    _onDragleave: function (/* event */) {
        var drag = this._drag;
        if ( !( this._nativeRefCount -= 1 ) && drag ) {
            drag.endDrag();
        }
    }.on( 'dragleave' ),

    /**
        Method (private): O.DragController._onDrop

        Tracks drop events to pass them to the active <O.Drag> instance.

        Parameters:
            event - {Event} The drop event.
    */
    _onDrop: function ( event ) {
        var drag = this._drag;
        if ( drag ) {
            if ( drag.get( 'dropEffect' ) !== DEFAULT ) {
                event.preventDefault();
            }
            // Dragend doesn't fire if the drag didn't start
            // inside the window, so we also call drag end on drop.
            drag.drop( event ).endDrag();
        }
    }.on( 'drop' ),

    /**
        Method (private): O.DragController._onDragend

        Tracks dragend events to pass them to the active <O.Drag> instance.

        Parameters:
            event - {Event} The dragend event.
    */
    _onDragend: function (/* event */) {
        var drag = this._drag;
        if ( drag ) {
            drag.endDrag();
        }
    }.on( 'dragend' ),

    // === Cancel on escape ===

    /**
        Method (private): O.DragController._escCancel

        Cancels the drag if the escape key is hit whilst the drag is in
        progress.

        Parameters:
            event - {Event} The keydown event.
    */
    _escCancel: function ( event ) {
        var drag = this._drag;
        if ( drag && DOMEvent.lookupKey( event ) === 'esc' ) {
            drag.endDrag();
        }
    }.on( 'keydown' ),
});

[ 'dragover', 'dragenter', 'dragleave', 'drop', 'dragend' ]
    .forEach( function ( type ) {
        document.addEventListener( type, DragController, false );
    });

ViewEventsController.addEventTarget( DragController, 20 );

export default DragController;

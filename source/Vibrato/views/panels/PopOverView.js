// -------------------------------------------------------------------------- \\
// File: PopOverView.js                                                       \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var PopOverEventHandler = NS.Class({

    Extends: NS.Object,

    inPopOver: function ( event ) {
        var view = event.targetView,
            popOver = this._view;
        while ( view && view !== popOver ) {
            view = view.get( 'parentView' );
        }
        return !!view;
    },

    _seenMouseDown: false,

    // If a user clicks outside the menu we want to close it. But we don't want
    // the mousedown/mouseup/click events to propogate to what's below. The
    // events fire in that order, and not all are guaranteed to fire (the user
    // could mousedown and drag their mouse out of the window before releasing
    // it or vica versa. If there is a drag in between mousedown and mouseup,
    // the click event won't fire).
    //
    // The safest to hide on is click, as we know there are no more events from
    // this user interaction which we need to capture, and it also means the
    // user has clicked and released outside the pop over; a decent indication
    // we should close it. However, if the pop over was triggered on mousedown
    // we may still see a mouseup and a click event from this initial user
    // interaction, but these musn't hide the view. Therefore, we make sure
    // we've seen at least one mousedown event after the popOver view shows
    // before hiding on click.
    handleMouse: function ( event ) {
        var type = event.type;
        if ( !this.inPopOver( event ) ) {
            event.stopPropagation();
            if ( type === 'mousedown' ) {
                this._seenMouseDown = true;
            } else if ( type === 'click' ) {
                event.preventDefault();
                if ( this._seenMouseDown ) {
                    this._view.hide();
                }
            }
        }
    }.on( 'click', 'mousedown', 'mouseup' ),

    handleKeys: function ( event ) {
        if ( !this.inPopOver( event ) ) {
            event.stopPropagation();
            // Pop over view may be interested in key events:
            this._view._options.view.fire( event.type, event );
            if ( NS.DOMEvent.lookupKey( event ) === 'esc' ) {
                this._view.hide();
            }
        }
    }.on( 'keypress', 'keydown', 'keyup' )
});

var PopOverView = NS.Class({

    Extends: NS.View,

    className: 'PopOverView',

    positioning: 'absolute',

    /*
        Options
        - view -> The view to append to the pop over
        - alignWithView -> the view to align to
        - atNode -> the node within the view to align to
        - withEdge -> 'left'/'right'/'centre'
        - showCallout -> true/false
        - offsetLeft
        - offsetTop
        - onHide: fn
    */
    show: function ( options ) {
        this.hide();

        this._options = options;

        // Set layout and insert in the right place
        var view = options.view,
            alignWithView = options.alignWithView,
            atNode = options.atNode || alignWithView.get( 'layer' ),
            withEdge = options.withEdge,
            parent = options.atNode ?
                alignWithView : alignWithView.get( 'parentView' ),
            position, offset;

        if ( withEdge === 'left' ) { withEdge = null; }

        // Want nearest parent scroll view (or root view if none).
        while ( !( parent instanceof NS.RootView ) &&
                !( parent instanceof NS.ScrollView ) ) {
            parent = parent.get( 'parentView' );
        }

        // Now find out our offsets;
        position = NS.Element.getPosition( atNode, parent.get( 'layer' ) );
        position.top += atNode.offsetHeight + ( options.offsetTop || 0 );
        position.left += options.offsetLeft || 0;
        position.zIndex = 1000;

        if ( withEdge ) {
            offset = atNode.offsetWidth;
            if ( withEdge === 'centre' ) { offset = ~~( offset >> 1 ); }
            position.left += offset;
        }

        // Set layout
        this.set( 'layout', position );

        // Callout
        if ( options.showCallout ) {
            this.get( 'layer' ).appendChild(
                NS.Element.create( 'b', {
                    className: 'callout ' + ( withEdge || 'left' )
                })
            );
        }

        // Insert views
        this.insertView( view );
        parent.insertView( this );

        // Adjust positioning if not left-aligned
        if ( withEdge ) {
            offset = this.get( 'layer' ).offsetWidth;
            if ( withEdge === 'centre' ) { offset = ~~( offset >> 1 ); }
            position.left -= offset;
            this.propertyDidChange( 'layout' );
        }

        NS.RootViewController.pushResponder( this.get( 'eventHandler' ) );
    },

    hide: function () {
        var parent = this.get( 'parentView' ),
            eventHandler = this.get( 'eventHandler' ),
            options = this._options,
            onHide, view, layer;
        if ( parent ) {
            if ( onHide = options.onHide ) {
                onHide();
            }
            view = options.view;
            parent.removeView( this );
            this.removeView( view );
            if ( options.showCallout ) {
                layer = this.get( 'layer' );
                layer.removeChild( layer.firstChild );
            }
            NS.RootViewController.removeResponder( eventHandler );
            eventHandler._seenMouseDown = false;
            this._options = null;
        }
    },

    eventHandler: function () {
        return new PopOverEventHandler({ _view: this });
    }.property(),

    stopEvents: function ( event ) {
        event.stopPropagation();
    }.on( 'click', 'mousedown', 'mouseup', 'keypress', 'keydown', 'keyup' )
});

NS.PopOverView = PopOverView;

}( this.O ) );

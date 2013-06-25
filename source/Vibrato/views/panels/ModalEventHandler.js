// -------------------------------------------------------------------------- \\
// File: ModalEventHandler.js                                                 \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ModalEventHandler = NS.Class({

    Extends: NS.Object,

    init: function ( mixin ) {
        ModalEventHandler.parent.init.call( this, mixin );
        this._seenMouseDown = false;
    },

    inView: function ( event ) {
        var targetView = event.targetView,
            view = this.get( 'view' );
        while ( targetView && targetView !== view ) {
            targetView = targetView.get( 'parentView' );
        }
        return !!targetView;
    },

    // If a user clicks outside the menu we want to close it. But we don't want
    // the mousedown/mouseup/click events to propagate to what's below. The
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
        var type = event.type,
            view;
        if ( !event.seenByModal && !this.inView( event ) ) {
            event.stopPropagation();
            if ( type === 'mousedown' || type === 'tap' ) {
                this._seenMouseDown = true;
            } else if ( type === 'click' ) {
                event.preventDefault();
                if ( this._seenMouseDown ) {
                    view = this.get( 'view' );
                    if ( view.clickedOutside ) {
                        view.clickedOutside( event );
                    }
                }
            }
        }
        event.seenByModal = true;
    }.on( 'click', 'mousedown', 'mouseup', 'tap' ),

    handleKeys: function ( event ) {
        if ( !event.seenByModal && !this.inView( event ) ) {
            event.stopPropagation();
            // View may be interested in key events:
            var view = this.get( 'view' );
            if ( view.keyOutside ) {
                view.keyOutside( event );
            }
        }
        event.seenByModal = true;
    }.on( 'keypress', 'keydown', 'keyup' ),

    handleTouch: function ( event ) {
        if ( !this.inView( event ) ) {
            event.preventDefault();
        }
    }.on( 'touchstart' )
});

NS.ModalEventHandler = ModalEventHandler;

}( this.O ) );

// -------------------------------------------------------------------------- \\
// File: ModalOverlayView.js                                                  \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ModalOverlayView = NS.Class({

    Extends: NS.View,

    className: 'ModalOverlayView',

    positioning: 'absolute',
    layout: NS.extend({
        zIndex: 5000
    }, NS.View.LAYOUT_FILL_PARENT ),

    rootView: null,

    eventHandler: function () {
        return new NS.ModalEventHandler({ view: this });
    }.property(),

    didEnterDocument: function () {
        NS.ViewEventsController.addEventTarget(
            this.get( 'eventHandler' ), 10 );
        return ModalOverlayView.parent.didEnterDocument.call( this );
    },
    willLeaveDocument: function () {
        NS.ViewEventsController.removeEventTarget( this.get( 'eventHandler' ) );
        return ModalOverlayView.parent.willLeaveDocument.call( this );
    },

    stopEvents: function ( event ) {
        event.stopPropagation();
    }.on( 'click', 'mousedown', 'mouseup',
        'keypress', 'keydown', 'keyup', 'tap' ),

    show: function () {
        this.get( 'rootView' ).insertView( this );
    },
    hide: function () {
        this.get( 'rootView' ).removeView( this );
    }
});

NS.ModalOverlayView = ModalOverlayView;

}( this.O ) );

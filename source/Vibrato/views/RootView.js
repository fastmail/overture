// -------------------------------------------------------------------------- \\
// File: RootView.js                                                          \\
// Module: View                                                               \\
// Requires: View.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var RootView = NS.Class({

    Extends: NS.View,

    isInDocument: true,
    isRendered: true,

    layer: null,

    init: function ( node, mixin ) {
        RootView.parent.init.call( this, mixin );

        // Node.DOCUMENT_NODE => 9.
        var nodeIsDocument = ( node.nodeType === 9 ),
            doc = nodeIsDocument ? node : node.ownerDocument,
            win = doc.defaultView,
            events, l;

        events = [
            'click', 'mousedown', 'mouseup',
            'keypress', 'keydown', 'keyup',
            'dragstart', 'selectstart',
            'touchstart', 'touchmove', 'touchend', 'touchcancel',
            'cut'
        ];
        for ( l = events.length; l--; ) {
            node.addEventListener( events[l], this, false );
        }
        // These events don't bubble: have to capture.
        // In IE, we use a version of focus and blur which will bubble, but
        // there's no way of bubbling/capturing change and input.
        // These events are automatically added to all inputs when created
        // instead.
        events = [ 'focus', 'blur', 'change', 'input' ];
        for ( l = events.length; l--; ) {
            node.addEventListener( events[l], this, true );
        }
        events = [ 'resize', 'orientationchange', 'scroll' ];
        for ( l = events.length; l--; ) {
            win.addEventListener( events[l], this, false );
        }

        this.layer = nodeIsDocument ? node.body : node;
    },

    _onScroll: function ( event ) {
        var layer = this.get( 'layer' ),
            isBody = ( layer.nodeName === 'BODY' ),
            doc = layer.ownerDocument,
            win = doc.defaultView,
            html = doc.documentElement,
            left = isBody ?
                // pageXOffset for everything but IE8.
                win.pageXOffset || html.scrollLeft || 0 :
                layer.scrollLeft,
            top = isBody ?
                // pageYOffset for everything but IE8.
                win.pageYOffset || html.scrollTop || 0 :
                layer.scrollTop;
        this.beginPropertyChanges()
                .set( 'scrollLeft', left )
                .set( 'scrollTop', top )
            .endPropertyChanges();
        event.stopPropagation();
    }.on( 'scroll' ),

    pxLeft: 0,
    pxTop: 0,

    pxWidth: function () {
        var layer = this.get( 'layer' );
        return layer.nodeName === 'BODY' ?
            layer.parentNode.clientWidth : layer.offsetWidth;
    }.property( 'pxLayout' ),

    pxHeight: function () {
        var layer = this.get( 'layer' );
        return layer.nodeName === 'BODY' ?
            layer.parentNode.clientHeight : layer.offsetHeight;
    }.property( 'pxLayout' ),

    handleEvent: function ( event ) {
        var type = event.type;

        // We observe mousemove when mousedown.
        if ( type === 'mousedown' ) {
            this.get( 'layer' ).ownerDocument
                .addEventListener( 'mousemove', this, false );
        } else if ( type === 'mouseup' ) {
            this.get( 'layer' ).ownerDocument
                .removeEventListener( 'mousemove', this, false );
        }

        // Window resize events: just notify parent has resized.
        if ( type === 'resize' || type === 'orientationchange' ) {
            this.parentViewDidResize();
        }
        // Scroll events are special.
        else if ( type === 'scroll') {
            this._onScroll( event );
        }
        // Normal events: send down the eventTarget chain.
        else {
            NS.ViewEventsController.handleEvent( event );
        }
    }.invokeInRunLoop()
});

NS.RootView = RootView;

}( this.O ) );

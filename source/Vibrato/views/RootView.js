// -------------------------------------------------------------------------- \\
// File: RootView.js                                                          \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, Node */

"use strict";

( function ( NS ) {

var RootViewController = {
    _activeViews: {},
    registerActiveView: function ( view ) {
        this._activeViews[ view.get( 'id' ) ] = view;
        return this;
    },
    deregisterActiveView: function ( view ) {
        delete this._activeViews[ view.get( 'id' ) ];
        return this;
    },
    getViewFromNode: function ( node ) {
        var activeViews = this._activeViews,
            doc = node.ownerDocument,
            view;
        while ( !view && node && node !== doc ) {
            view = activeViews[ node.id ];
            node = node.parentNode;
        }
        return view;
    },
    
    _responders: [],
    
    // First responder: will be notified of event before views.
    pushResponder: function ( responder ) {
        this._responders.push( responder );
        return this;
    },
    // Last responder: will be notified of event after views.
    queueResponder: function ( responder ) {
        this._responders.unshift( responder );
        return this;
    },
    // Stop being notified of events.
    removeResponder: function ( responder ) {
        this._responders.erase( responder );
        return this;
    },
    
    handleEvent: function ( event, view ) {
        var responders = this._responders,
            l = responders.length,
            responder;
        
        if ( !view ) {
            view = this.getViewFromNode( event.target );
        }
        event.targetView = view;
        event.phase = 'beforeViews';
        
        while ( l-- ) {
            responder = responders[l];
            if ( responder === this ) {
                responder = view;
                event.phase = 'views';
            }
            if ( responder && responder.fire( event.type, event ) ) {
                break;
            }
            if ( responders[l] === this ) {
                event.phase = 'afterViews';
            }
        }
    }.invokeInRunLoop()
};
RootViewController.pushResponder( RootViewController );

var RootView = NS.Class({
    
    Extends: NS.View,
    
    isInDocument: true,
    isRendered: true,
    
    layer: null,
    
    init: function ( node ) {
        RootView.parent.init.call( this );
        
        var nodeIsDocument = node.nodeType === Node.DOCUMENT_NODE,
            doc = nodeIsDocument ? node : node.ownerDocument,
            win = doc.defaultView,
            events, l;
        
        events = [ 'click', 'mousedown', 'mouseup',
            'keypress', 'keydown', 'keyup', 'dragstart', 'selectstart' ];
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
        events = [ 'resize', 'orientationchange' ];
        for ( l = events.length; l--; ) {
            win.addEventListener( events[l], this, false );
        }
        
        this.layer = nodeIsDocument ? node.body : node;
    },
    
    pxLeft: 0,
    pxTop: 0,

    pxWidth: function () {
        var layer = this.get( 'layer' );
        return layer.nodeName === 'BODY' ?
            layer.parentNode.clientWidth : layer.offsetWidth;
    }.property( 'pxDimensions' ),
    
    pxHeight: function () {
        var layer = this.get( 'layer' );
        return layer.nodeName === 'BODY' ?
            layer.parentNode.clientHeight : layer.offsetHeight;
    }.property( 'pxDimensions' ),
    
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
        // Normal events: send down the responder change.
        else {
            RootViewController.handleEvent( event );
        }
    }.invokeInRunLoop()
});

// Expose Globals:

NS.RootView = RootView;
NS.RootViewController = RootViewController;

}( O ) );
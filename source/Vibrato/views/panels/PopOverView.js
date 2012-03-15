// -------------------------------------------------------------------------- \\
// File: PopOverView.js                                                       \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

var PopOverEventHandler = O.Class({
    
    Extends: O.Object,
    
    inPopOver: function ( event ) {
        var view = event.targetView,
            popOver = this._view;
        while ( view && view !== popOver ) {
            view = view.get( 'parentView' );
        }
        return !!view;
    },
    
    handleMouse: function ( event ) {
        if ( !this.inPopOver( event ) ) {
            event.preventDefault();
            event.stopPropagation();
            if ( event.type === 'click' ) {
                this._view.hide();
            }
        }
    }.on( 'click', 'mousedown', 'mouseup' ),
    
    handleKeys: function ( event ) {
        if ( !this.inPopOver( event ) ) {
            event.stopPropagation();
            // Pop over view may be interested in key events:
            this._view._contentView.fire( event.type, event );
            if ( NS.DOMEvent.lookupKey( event ) === 'esc' ) {
                this._view.hide();
            }
        }
    }.on( 'keypress', 'keydown', 'keyup' )
});

var PopOverView = NS.Class({
    
    Extends: NS.View,
    
    align: 'left',
    showCallout: false,
    calloutClass: function () {
        return this.get( 'showCallout' ) ?
            'callout ' + this.get( 'align' ) : 'hidden';
    }.property( 'showCallout', 'align' ),
    
    className: function () {
        return 'PopOverView' +
            ( this.get( 'showCallout' ) ? ' calloutShown' : '' );
    }.property( 'showCallout' ),
    
    _render: function ( layer ) {
        layer.appendChild( NS.Element.create( 'b', {
            className: O.bind( 'calloutClass', this )
        }) );
        PopOverView.parent._render.call( this, layer );
    },
    
    _contentView: null,

    /*
        Options
        - view -> The view to append to the pop over
        - alignWithView -> the view to align to
        - atNode -> the node within the view to align to
        - withEdge: 'left'/'right'/'centre'
        - offsetLeft
        - offsetTop
    */
    show: function ( options ) {
        this.hide();
        
        // Set layout and insert in the right place
        var view = this._contentView = options.view,
            alignWithView = options.alignWithView,
            atNode = options.atNode || alignWithView.get( 'layer' ),
            withEdge = options.withEdge,
            parent = options.atNode ?
                alignWithView : alignWithView.get( 'parentView' ),
            position, offset;
        
        if ( withEdge === 'left' ) { withEdge = null; }
        this.set( 'align', withEdge || 'left' );
        
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
        
        this.set( 'layout', position );
        this.insertView( view );
        parent.insertView( this );
        
        if ( withEdge ) {
            offset = this.get( 'layer' ).offsetWidth;
            if ( withEdge === 'centre' ) { offset = ~~( offset >> 1 ); }
            position.left -= offset;
            this.propertyDidChange( 'layout' );
        }
        
        NS.RootViewController.pushResponder( this.get( 'eventHandler' ) );
    },
    
    hide: function () {
        var parent = this.get( 'parentView' );
        if ( parent ) {
            var view = this._contentView;
            this._contentView = null;
            NS.RootViewController.removeResponder( this.get( 'eventHandler' ) );
            parent.removeView( this );
            this.removeView( view );
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

}( O ) );
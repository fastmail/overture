// -------------------------------------------------------------------------- \\
// File: InfoBubbleView.js                                                    \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var InfoBubbleView = NS.Class({

    Extends: NS.View,

    zIndex: 5000,

    isHidden: true,
    alignWithView: null,
    alignToThe: 'top',
    text: '',

    positioning: 'absolute',

    // Don't suspend, as may insert itself based on bindings.
    suspendBindings: function () {
        return this;
    },
    resumeBindings: function () {
        return this;
    },

    className: function () {
        return 'InfoBubbleView ' + this.get( 'alignToThe' );
    }.property( 'alignToThe' ),

    insertOrRemove: function () {
        var shouldBeInDoc = !this.get( 'isHidden' ) &&
                !!this.get( 'alignWithView' ),
            isInDocument = this.get( 'isInDocument' ),
            rootView = this.get( 'rootView' );
        if ( shouldBeInDoc && !isInDocument ) {
            rootView.insertView( this );
        }
        if ( !shouldBeInDoc && isInDocument ) {
            rootView.removeView( this );
        }
    }.queue( 'render' ).observes( 'isHidden', 'alignWithView' ),

    monitorScrolls: function () {
        var alignWithView = this.get( 'alignWithView' ),
            scrollAncestors = this._scrollAncestors;
        if ( scrollAncestors ) {
            scrollAncestors.forEach( function ( view ) {
                view.off( 'scroll', this, 'parentViewDidResize' );
            });
        }
        scrollAncestors = null;
        if ( alignWithView ) {
            scrollAncestors = [];
            while ( alignWithView = alignWithView.getParent( NS.ScrollView ) ) {
                alignWithView.on( 'scroll', this, 'parentViewDidResize' );
                scrollAncestors.push( alignWithView );
            }
        }
        this._scrollAncestors = scrollAncestors;
    }.observes( 'alignWithView' ),

    layout: function () {
        var alignWithView = this.get( 'alignWithView' );
        if ( !alignWithView ) { return {}; }

        var alignToThe = this.get( 'alignToThe' ),
            bounds = alignWithView.get( 'layer' ).getBoundingClientRect(),
            layout = {
                top: parseInt( bounds.top, 10 ),
                left: parseInt( bounds.left, 10 ),
            };

        if ( alignToThe === 'right' ) {
            // IE8 doesn't support bounds.width
            layout.left += parseInt( bounds.right - bounds.left, 10 );
        }
        else if ( alignToThe === 'bottom' ) {
            // IE8 doesn't support bounds.height
            layout.top += parseInt( bounds.bottom - bounds.top, 10 );
        }
        return layout;
    }.property( 'alignWithView', 'alignToThe' ),

    draw: function ( layer ) {
        var el = NS.Element.create;
        layer.appendChild( el( 'span', [
            el( 'span', {
                text: NS.bind( 'text', this )
            }),
            el( 'b' )
        ]) );
    },

    parentViewDidResize: function () {
        this.computedPropertyDidChange( 'layout' );
    }
});

NS.InfoBubbleView = InfoBubbleView;

}( this.O ) );

// -------------------------------------------------------------------------- \\
// File: SplitViewDivider.js                                                  \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js, SplitView.js, Draggable.js       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var SplitDividerView = NS.Class({

    Extends: NS.View,

    Mixin: NS.Draggable,

    className: 'SplitDividerView',

    thickness: 10,

    length: NS.bindTwoWay( 'parentView.staticPaneLength' ),

    min: NS.bind( 'parentView.minStaticPaneLength' ),
    max: NS.bind( 'parentView.maxStaticPaneLength' ),

    direction: NS.bind( 'parentView.direction' ),
    flex: NS.bind( 'parentView.flex' ),

    anchor: function () {
        var flexTL = this.get( 'flex' ) === NS.SplitView.TOP_LEFT,
            isVertical = this.get( 'direction' ) === NS.SplitView.VERTICAL;
        return isVertical ?
            ( flexTL ? 'right' : 'left' ) : ( flexTL ? 'bottom' : 'top' );
    }.property( 'flex', 'direction' ),

    positioning: 'absolute',

    layout: function () {
        var thickness = this.get( 'thickness' ),
            styles;
        if ( this.get( 'direction' ) === NS.SplitView.VERTICAL ) {
            styles = {
                top: 0,
                bottom: 0,
                width: thickness
            };
        } else {
            styles = {
                left: 0,
                right: 0,
                height: thickness
            };
        }
        styles[ this.get( 'anchor' ) ] =
            this.get( 'length' ) - ( thickness / 2 );
        return styles;
    }.property( 'direction', 'anchor', 'thickness', 'length' ),

    dragStarted: function ( drag ) {
        this._length = this.get( 'length' );
        this._dir = ( this.get( 'direction' ) === NS.SplitView.VERTICAL ) ?
            'x' : 'y';
    },

    dragMoved: function ( drag ) {
        var dir = this._dir,
            delta = drag.get( 'cursorLocation' )[ dir ] -
                drag.get( 'startLocation' )[ dir ];
        this.set( 'length', ( this._length + delta ).limit(
            this.get( 'min' ), this.get( 'max' ) ) );
    }
});

NS.SplitDividerView = SplitDividerView;

}( this.O ) );

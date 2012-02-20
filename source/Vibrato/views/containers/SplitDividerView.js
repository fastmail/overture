// -------------------------------------------------------------------------- \\
// File: SplitViewDivider.js                                                  \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js, SplitView.js, Draggable.js       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

var SplitDividerView = NS.Class({
    
    Extends: NS.View,
    
    Mixin: NS.Draggable,
    
    thickness: 10,
    
    length: new O.Binding({
        isTwoWay: true
    }).from( 'parentView.staticPaneLength' ),
    
    min: O.bind( 'parentView.minStaticPaneLength' ),
    max: O.bind( 'parentView.maxStaticPaneLength' ),
    
    direction: O.bind( 'parentView.direction' ),
    flex: O.bind( 'parentView.flex' ),
    
    anchor: function () {
        var flexTL = this.get( 'flex' ) === NS.SplitView.TOP_LEFT,
            isVertical = this.get( 'direction' ) === NS.SplitView.VERTICAL;
        return isVertical ?
            ( flexTL ? 'right' : 'left' ) : ( flexTL ? 'bottom' : 'top' );
    }.property( 'flex', 'direction' ),
        
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

}( O ) ); // End SplitView closure.
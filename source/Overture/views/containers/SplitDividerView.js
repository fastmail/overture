// -------------------------------------------------------------------------- \\
// File: SplitViewDivider.js                                                  \\
// Module: ContainerViews                                                     \\
// Requires: Core, Foundation, View, DragDrop, SplitViewController.js         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var VERTICAL = NS.SplitViewController.VERTICAL;

/**
    Class: O.SplitDividerView

    Extends: O.View

    Includes: O.Draggable

    An O.SplitDividerView instance represents the divide between two panes
    controllered by an <O.SplitViewController> instance. It can be dragged to
    resize the static pane in the split view.
*/
var SplitDividerView = NS.Class({

    Extends: NS.View,

    Mixin: NS.Draggable,

    /**
        Property: O.SplitDividerView#className
        Type: String
        Default: 'v-SplitDivider'

        Overrides default in O.View#className.
    */
    className: 'v-SplitDivider',

    /**
        Property: O.SplitDividerView#thickness
        Type: Number
        Default: 10

        How many pixels wide (if vertical split) or tall (if horizontal split)
        the view should be. Note, by default the view is invisible, so this
        really represents the hit area for dragging.
    */
    thickness: 10,

    /**
        Property: O.SplitDividerView#controller
        Type: O.SplitViewController

        The controller for the split view.
    */

    /**
        Property: O.SplitDividerView#offset
        Type: Number

        Bound two-way to the <O.SplitViewController#staticPaneLength>. It is
        the distance from the edge of the split view that the split divider
        view should be positioned.
    */
    offset: NS.bindTwoWay( 'controller.staticPaneLength' ),

    /**
        Property: O.SplitDividerView#min
        Type: Number

        Bound to the <O.SplitViewController#minStaticPaneLength>.
    */
    min: NS.bind( 'controller.minStaticPaneLength' ),

    /**
        Property: O.SplitDividerView#max
        Type: Number

        Bound to the <O.SplitViewController#maxStaticPaneLength>.
    */
    max: NS.bind( 'controller.maxStaticPaneLength' ),

    /**
        Property: O.SplitDividerView#direction
        Type: Number

        Bound to the <O.SplitViewController#direction>.
    */
    direction: NS.bind( 'controller.direction' ),

    /**
        Property: O.SplitDividerView#flex
        Type: Number

        Bound to the <O.SplitViewController#flex>.
    */
    flex: NS.bind( 'controller.flex' ),

    /**
        Property: O.SplitDividerView#anchor
        Type: String

        The CSS property giving the side the <O.SplitDividerView#offset> is from
        (top/left/bottom/right).
    */
    anchor: function () {
        var flexTL = this.get( 'flex' ) === NS.SplitViewController.TOP_LEFT,
            isVertical = this.get( 'direction' ) === VERTICAL;
        return isVertical ?
            ( flexTL ? 'right' : 'left' ) : ( flexTL ? 'bottom' : 'top' );
    }.property( 'flex', 'direction' ),

    /**
        Property: O.SplitDividerView#positioning
        Type: String
        Default: 'absolute'

        Overrides default in O.View#positioning
   */
    positioning: 'absolute',

    /**
        Property: O.SplitDividerView#layout
        Type: Object

        Overrides default in O.View#layout to position the view based on the
        direction, anchor, thickness and offset properties.
    */
    layout: function () {
        var thickness = this.get( 'thickness' ),
            styles;
        if ( this.get( 'direction' ) === VERTICAL ) {
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
            this.get( 'offset' ) - ( thickness / 2 );
        return styles;
    }.property( 'direction', 'anchor', 'thickness', 'offset' ),

    /**
        Method: O.SplitDividerView#dragStarted

        Records the offset at the time the drag starts.
    */
    dragStarted: function () {
        this._offset = this.get( 'offset' );
        this._dir = ( this.get( 'direction' ) === VERTICAL ) ? 'x' : 'y';
    },

    /**
        Method: O.SplitDividerView#dragMoved

        Updates the offset property based on the difference between the current
        cursor position and the initial cursor position when the drag started.

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    dragMoved: function ( drag ) {
        var dir = this._dir,
            delta = drag.get( 'cursorPosition' )[ dir ] -
                drag.get( 'startPosition' )[ dir ];
        this.set( 'offset', ( this._offset + delta ).limit(
            this.get( 'min' ), this.get( 'max' ) ) );
    }
});

NS.SplitDividerView = SplitDividerView;

}( O ) );

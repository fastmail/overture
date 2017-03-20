// -------------------------------------------------------------------------- \\
// File: SplitViewController.js                                               \\
// Module: ContainerViews                                                     \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../../core/Core.js';  // Also Function#extend
import Object from '../../foundation/Object.js';
import '../../foundation/ComputedProps.js';  // For Function#property

var VERTICAL = 1;
var HORIZONTAL = 2;
var TOP_LEFT = 4;
var BOTTOM_RIGHT = 8;

var auto = 'auto';

/**
    Class: O.SplitViewController

    Extends: O.Object
*/
var SplitViewController = Class({

    Extends: Object,

    /**
        Property: O.SplitViewController#direction
        Type: Number
        Default: O.SplitViewController.VERTICAL

        The direction to split the view, either `O.SplitViewController.VERTICAL`
        (the default) or `O.SplitViewController.HORIZONTAL`.
    */
    direction: VERTICAL,

    /**
        Property: O.SplitViewController#flex
        Type: Number
        Default: O.SplitViewController.TOP_LEFT

        Which of the two panes should be the flexible one. Must be either
        `O.SplitViewController.TOP_LEFT` (default - the top pane is flexible if
        horizontally split, or the left pane is flexible if vertically split) or
        `O.SplitViewController.BOTTOM_RIGHT` (the right or bottom pane is
        flexible).
    */
    flex: TOP_LEFT,

    /**
        Property: O.SplitViewController#flex
        Type: Number
        Default: 200

        The number of pixels the static pane is wide/tall (depending on split
        direction).
    */
    staticPaneLength: 200,

    /**
        Property: O.SplitViewController#minStaticPaneLength
        Type: Number
        Default: 0

        The minimum width/height (in pixels) that the static pane may be resized
        to.
    */
    minStaticPaneLength: 0,

    /**
        Property: O.SplitViewController#maxStaticPaneLength
        Type: Number
        Default: 0

        The maximum width/height (in pixels) that the static pane may be resized
        to.
    */
    maxStaticPaneLength: 32767,

    /**
        Property: O.SplitViewController#topLeftLayout
        Type: Object

        The layout properties to use to position the top/left pane.
    */
    topLeftLayout: function ( layout ) {
        var flexDir = this.get( 'direction' ),
            flexPane = this.get( 'flex' ),
            staticLength = this.get( 'staticPaneLength' );
        return layout || {
            top: 0,
            left: 0,
            right: ( flexDir === VERTICAL &&
                flexPane === TOP_LEFT ) ? staticLength : auto,
            width: flexDir === HORIZONTAL ? '100%' :
                flexPane === TOP_LEFT ? auto : staticLength,
            bottom: ( flexDir === HORIZONTAL &&
                flexPane === TOP_LEFT ) ? staticLength : auto,
            height: flexDir === VERTICAL ? '100%' :
                flexPane === TOP_LEFT ? auto : staticLength
        };
    }.property( 'flex', 'direction', 'staticPaneLength' ),

    /**
        Property: O.SplitViewController#bottomRightLayout
        Type: Object

        The layout properties to use to position the bottom/right pane.
    */
    bottomRightLayout: function ( layout ) {
        var flexDir = this.get( 'direction' ),
            flexPane = this.get( 'flex' ),
            staticLength = this.get( 'staticPaneLength' );
        return layout || {
            bottom: 0,
            right: 0,
            left: ( flexDir === VERTICAL &&
                flexPane === BOTTOM_RIGHT ) ? staticLength : auto,
            width: flexDir === HORIZONTAL ? '100%' :
                flexPane === BOTTOM_RIGHT ? auto : staticLength,
            top: ( flexDir === HORIZONTAL &&
                flexPane === BOTTOM_RIGHT ) ? staticLength : auto,
            height: flexDir === VERTICAL ? '100%' :
                flexPane === BOTTOM_RIGHT ? auto : staticLength
        };
    }.property( 'flex', 'direction', 'staticPaneLength' )
});

SplitViewController.extend({
    VERTICAL: VERTICAL,
    HORIZONTAL: HORIZONTAL,
    TOP_LEFT: TOP_LEFT,
    BOTTOM_RIGHT: BOTTOM_RIGHT
});

export default SplitViewController;

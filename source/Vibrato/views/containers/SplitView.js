// -------------------------------------------------------------------------- \\
// File: SplitView.js                                                         \\
// Module: ContainerViews                                                     \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var VERTICAL = 1,
    HORIZONTAL = 2,
    TOP_LEFT = 4,
    BOTTOM_RIGHT = 8,

    topLeftView = 'topLeftView',
    bottomRightView = 'bottomRightView',
    dividerView = 'dividerView',
    auto = 'auto';

/**
    Class: O.SplitView

    Extends: O.View

    An O.SplitView instance divides itself into two panes. One of these is a
    fixed size and the other is flexible (sized to fill the remaining space).
    The division between the two panes can be dragged to resize the fixed-size
    pane.
*/
var SplitView = NS.Class({

    Extends: NS.View,

    /**
        Property: O.SplitView#direction
        Type: Number
        Default: O.SplitView.VERTICAL

        The direction to split the view. Must be either `O.SplitView.VERTICAL`
        (the default) or `O.SplitView.HORIZONTAL`. Note, this must not change
        after the view has been initialised, or behaviour is undefined.
    */
    direction: VERTICAL,

    /**
        Property: O.SplitView#flex
        Type: Number
        Default: O.SplitView.TOP_LEFT

        Which of the two panes should be the flexible one. Must be either
        `O.SplitView.TOP_LEFT` (default - the top pane is flexible if
        horizontally split, or the top pane is flexible if vertically split) or
        `O.SplitView.BOTTOM_RIGHT` (the right or bottom pane is flexible). Note,
        this must not change after the view has been initialised, or behaviour
        is undefined.
    */
    flex: TOP_LEFT,

    /**
        Property: O.SplitView#flex
        Type: Number
        Default: 200

        The number of pixels the static pane is wide/tall (depending on split
        direction).
    */
    staticPaneLength: 200,

    /**
        Property: O.SplitView#minStaticPaneLength
        Type: Number
        Default: 0

        The minimum width/height (in pixels) that the static pane may be resized
        to.
    */
    minStaticPaneLength: 0,

    /**
        Property: O.SplitView#maxStaticPaneLength
        Type: Number
        Default: 0

        The maximum width/height (in pixels) that the static pane may be resized
        to.
    */
    maxStaticPaneLength: 32767,

    /**
        Property: O.SplitView#topLeftView
        Type: O.View|null
        Default: 0

        The view instance to insert in the top/left pane.
    */
    topLeftView: null,

    /**
        Property: O.SplitView#bottomRightView
        Type: O.View|null
        Default: 0

        The view instance to insert in the bottom/right pane.
    */
    bottomRightView: null,

    init: function ( mixin ) {
        SplitView.parent.init.call( this, mixin );
        var childViews = this.get( 'childViews' ),
            tl = mixin[ topLeftView ],
            br = mixin[ bottomRightView ];
        if ( tl ) {
            tl.set( 'parentView', this );
            childViews.push( tl );
        }
        if ( br ) {
            br.set( 'parentView', this );
            childViews.push( br );
        }
        childViews.push( this.get( dividerView ) );
    },

    /**
        Property: O.SplitView#dividerView
        Type: O.SplitDividerView

        The <O.SplitDividerView> instance to insert as a child to form the drag
        handle for resizing the panes. By default, this creates and returns a
        new instance the first time it is requested.
    */
    dividerView: function () {
        return new NS.SplitDividerView({
            id: this.get( 'id' ) + '-' + 'divider',
            parentView: this
        });
    }.property(),

    /**
        Property: O.SplitView#dynamicCSSPropTL
        Type: String

        The CSS property that should be set on the top/left pane when the static
        pane length changes.
    */
    dynamicCSSPropTL: function () {
        var flex = this.get( 'flex' ) === TOP_LEFT;
        return this.get( 'direction' ) === VERTICAL ?
            ( flex ? 'right' : 'width' ) :
            ( flex ? 'bottom' : 'height' );
    }.property(),

    /**
        Property: O.SplitView#dynamicCSSPropTL
        Type: String

        The CSS property that should be set on the bottom/right pane when the
        static pane length changes.
    */
    dynamicCSSPropBR: function () {
        var flex = this.get( 'flex' ) === BOTTOM_RIGHT;
        return this.get( 'direction' ) === VERTICAL ?
            ( flex ? 'left' : 'width' ) :
            ( flex ? 'top' : 'height' );
    }.property(),

    /**
        Property: O.SplitView#positioning
        Type: String
        Default: 'absolute'

        Overrides default in <O.View#positioning>.
   */
    positioning: 'absolute',

    /**
        Property: O.SplitView#layout
        Type: Object
        Default:
                {
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                }

        Overrides default in <O.View#layout>.
    */
    layout: NS.View.LAYOUT_FILL_PARENT,

    /**
        Method: O.SplitView#draw

        Initial rendering of view. See <O.View#draw>.
    */
    draw: function ( layer ) {
        var Element = NS.Element,
            el = Element.create,
            tlview = this.get( topLeftView ),
            brview = this.get( bottomRightView ),
            flexDir = this.get( 'direction' ),
            flexPane = this.get( 'flex' ),
            leftFirst = ( flexPane === TOP_LEFT ),
            staticLength = this.get( 'staticPaneLength' ),
            tlpane = this._topLeftViewContainer = el( 'div', {
                id: this.get( 'id' ) + '-' +
                    ( flexDir === VERTICAL ? 'left': 'top' ),
                styles: {
                    position: 'absolute',
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
                }
            }),
            brpane = this._bottomRightViewContainer = el( 'div', {
                id: this.get( 'id' ) + '-' +
                    ( flexDir === VERTICAL ? 'right': 'bottom' ),
                styles: {
                    position: 'absolute',
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
                }
            });

        if ( tlview ) {
            tlpane.appendChild( tlview.render().get( 'layer' ) );
        }
        if ( brview ) {
            brpane.appendChild( brview.render().get( 'layer' ) );
        }

        // The flex pane is probably more important, so for the benefit of
        // screen readers, let's insert it higher in the HTML structure.
        Element.appendChildren( layer, [
            leftFirst ? tlpane : brpane,
            leftFirst ? brpane : tlpane,
            this.get( dividerView ).render().get( 'layer' )
        ]);
    },

    /**
        Method: O.SplitView#splitNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    splitNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'staticPaneLength' ),

    /**
        Method: O.SplitView#redrawStaticPaneLength

        Resizes the rendering of the panes when the
        <O.SplitView#staticPaneLength> property changes.
    */
    redrawStaticPaneLength: function () {
        var thickness = this.get( 'staticPaneLength' );
        this._topLeftViewContainer.style[
            this.get( 'dynamicCSSPropTL' ) ] = thickness + 'px';
        this._bottomRightViewContainer.style[
            this.get( 'dynamicCSSPropBR' ) ] = thickness + 'px';

        var tlView = this.get( topLeftView ),
            brView = this.get( bottomRightView );
        if ( tlView ) { tlView.parentViewDidResize(); }
        if ( brView ) { brView.parentViewDidResize(); }
    },

    /**
        Method: O.SplitView#replaceView

        See <O.View#replaceView>.

        Overridden to ensure <O.SplitView#topLeftView> and
        <O.SplitView#bottomRightView> properties get updated correctly.
    */
    replaceView: function ( view, oldView ) {
        if ( oldView === this.get( topLeftView ) ) {
            this.set( topLeftView, view );
        } else if ( oldView === this.get( bottomRightView ) ) {
            this.set( bottomRightView, view );
        } else {
            SplitView.parent.replaceView.call( this, view, oldView );
        }
        return this;
    },

    /**
        Method: O.SplitView#removeView

        See <O.View#removeView>.

        Overridden to ensure <O.SplitView#topLeftView> and
        <O.SplitView#bottomRightView> properties get updated correctly.
    */
    removeView: function ( view ) {
        if ( view === this.get( topLeftView ) ) {
            this.set( topLeftView, null );
        } else if ( view === this.get( bottomRightView ) ) {
            this.set( bottomRightView, null );
        } else {
            SplitView.parent.removeView.call( this, view );
        }
        return this;
    },

    /**
        Method (private): O.SplitView#_viewDidChange

        Calls the appropriate insert/remove/replace method when
        the <O.SplitView#topLeftView> or <O.SplitView#bottomRightView>
        property changes.

        Parameters:
            _       - {*} Ignored.
            key     - {String} Either 'topLeftView' or 'bottomRightView'.
            oldView - {O.View|null} The previous value of the property.
    */
    _viewDidChange: function ( _, key, oldView ) {
        var view = this.get( key );
        if ( oldView && view ) {
            SplitView.parent.replaceView.call( this, view, oldView );
        } else if ( oldView ) {
            SplitView.parent.removeView.call( this, oldView );
        } else if ( view ) {
            SplitView.parent.insertView.call( this, view,
                this[ '_' + key + 'Container' ], 'bottom' );
        }
    }.observes( topLeftView, bottomRightView )
});

SplitView.extend({
    VERTICAL: VERTICAL,
    HORIZONTAL: HORIZONTAL,
    TOP_LEFT: TOP_LEFT,
    BOTTOM_RIGHT: BOTTOM_RIGHT
});

NS.SplitView = SplitView;

}( this.O ) );

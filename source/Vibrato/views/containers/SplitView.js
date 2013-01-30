// -------------------------------------------------------------------------- \\
// File: SplitView.js                                                         \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
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
    auto = 'auto',

SplitView = NS.Class({

    Extends: NS.View,

    // These must not change after init or behaviour is undefined.
    direction: VERTICAL,
    flex: TOP_LEFT,

    staticPaneLength: 200,
    minStaticPaneLength: 0,
    maxStaticPaneLength: 32767,

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

    // This can be overriden by simply
    // setting the property in the anonymous
    // subclass.
    dividerView: function () {
        return new NS.SplitDividerView({
            id: this.get( 'id' ) + '-' + 'divider',
            parentView: this
        });
    }.property(),

    positioning: 'absolute',

    layout: NS.View.LAYOUT_FILL_PARENT,

    draw: function ( layer ) {
        var tlview = this.get( topLeftView ),
            brview = this.get( bottomRightView ),
            flexDir = this.get( 'direction' ),
            flexPane = this.get( 'flex' ),
            staticLength = this.get( 'staticPaneLength' ),
            el = NS.Element.create,
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
        var leftFirst = ( flexPane === TOP_LEFT );
        NS.Element.appendChildren( layer, [
            leftFirst ? tlpane : brpane,
            leftFirst ? brpane : tlpane,
            this.get( dividerView ).render().get( 'layer' )
        ]);
    },

    dynamicCSSPropTL: function () {
        var flex = this.get( 'flex' ) === TOP_LEFT;
        return this.get( 'direction' ) === VERTICAL ?
            ( flex ? 'right' : 'width' ) :
            ( flex ? 'bottom' : 'height' );
    }.property(),

    dynamicCSSPropBR: function () {
        var flex = this.get( 'flex' ) === BOTTOM_RIGHT;
        return this.get( 'direction' ) === VERTICAL ?
            ( flex ? 'left' : 'width' ) :
            ( flex ? 'top' : 'height' );
    }.property(),

    propertyNeedsRedraw: function () {
        return SplitView.parent
            .propertyNeedsRedraw.apply( this, arguments );
    }.observes( 'className', 'layerStyles', 'staticPaneLength' ),

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

    // Must set a specific view
    insertView: null,

    replaceView: function ( view, oldView ) {
        if ( oldView === this.get( topLeftView ) ) {
            this.set( topLeftView, view );
        } else if ( oldView === this.get( bottomRightView ) ) {
            this.set( bottomRightView, view );
        }
        return this;
    },

    removeView: function ( view ) {
        if ( view === this.get( topLeftView ) ) {
            this.set( topLeftView, null );
        } else if ( view === this.get( bottomRightView ) ) {
            this.set( bottomRightView, null );
        }
        return this;
    },

    _viewDidChange: function ( _, key, oldView ) {
        var view = this.get( 'view' );
        if ( oldView && view ) {
            SplitView.parent.replaceView.call( view, oldView );
        } else if ( oldView ) {
            SplitView.parent.removeView.call( oldView );
        } else if ( view ) {
            SplitView.parent.insertView.call( view,
                'bottom', this[ '_' + key + 'Container' ] );
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

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
    
    childViews: function () {
        var children = [],
            tl = this.get( topLeftView ),
            br = this.get( bottomRightView );
        if ( tl ) { children.push( tl ); }
        if ( br ) { children.push( br ); }
        children.push( this.get( dividerView ) );
        return children;
    }.property( topLeftView, bottomRightView, dividerView ),
    
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
    _render: function ( layer ) {
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
        layer.appendChild( leftFirst ? tlpane : brpane );
        layer.appendChild( leftFirst ? brpane : tlpane );
        layer.appendChild( this.get( dividerView ).render().get( 'layer' ) );
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
    
    _lengthDidChange: function () {
        if ( !this.get( 'isRendered' ) ) { return; }
        var thickness = this.get( 'staticPaneLength' );
        this._topLeftViewContainer.style[
            this.get( 'dynamicCSSPropTL' ) ] = thickness + 'px';
        this._bottomRightViewContainer.style[
            this.get( 'dynamicCSSPropBR' ) ] = thickness + 'px';
        
        var tlView = this.get( topLeftView ),
            brView = this.get( bottomRightView );
        if ( tlView ) { tlView.parentViewDidResize(); }
        if ( brView ) { brView.parentViewDidResize(); }
    }.observes( 'staticPaneLength' ),
    
    _viewDidChange: function ( _, key, oldView, view ) {
        if ( view ) {
            view.set( 'parentView', this );
        }
        if ( this.get( 'isRendered' ) ) {
            var isInDocument = this.get( 'isInDocument' );
            if ( view ) {
                view.render();
            }
            var container = this[ '_' + key + 'Container' ];
            if ( view && oldView ) {
                if ( isInDocument ) {
                    oldView.willRemoveLayerFromDocument();
                    view.willAppendLayerToDocument();
                }
                container.replaceChild(
                    view.get( 'layer' ), oldView.get( 'layer' ) );
                if ( isInDocument ) {
                    oldView.didRemoveLayerFromDocument();
                    view.didAppendLayerToDocument();
                }
            } else if ( view ) {
                if ( isInDocument ) {
                    view.willAppendLayerToDocument();
                }
                container.appendChild( view.get( 'layer' ) );
                if ( isInDocument ) {
                    view.didAppendLayerToDocument();
                }
            }
            else if ( oldView ) {
                if ( isInDocument ) {
                    oldView.willRemoveLayerFromDocument();
                }
                container.removeChild( oldView.get( 'layer' ) );
                if ( isInDocument ) {
                    oldView.didRemoveLayerFromDocument();
                }
            }
        }
        if ( oldView ) {
            oldView.set( 'parentView', null );
        }
    }.observes( topLeftView, bottomRightView ),

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
    }
});

SplitView.extend({
    VERTICAL: VERTICAL,
    HORIZONTAL: HORIZONTAL,
    TOP_LEFT: TOP_LEFT,
    BOTTOM_RIGHT: BOTTOM_RIGHT
});

NS.SplitView = SplitView;

}( this.O ) );
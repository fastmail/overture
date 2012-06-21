// -------------------------------------------------------------------------- \\
// File: ToolbarView.js                                                       \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ToolbarView = NS.Class({

    Extends: NS.View,

    className: 'ToolbarView',

    config: 'standard',

    init: function ( options ) {
        ToolbarView.parent.init.call( this, options );
        this._views = {};
        this._configs = {};
    },

    registerViews: function ( views ) {
        for ( var name in views ) {
            this.registerView( name, views[ name ] );
        }
        return this;
    },

    registerView: function ( name, view ) {
        this._views[ name ] = view;
        view.set( 'target', this );
        return this;
    },

    registerConfigs: function ( configs ) {
        for ( var name in configs ) {
            this.registerConfig( name, configs[ name ] );
        }
        return this;
    },

    registerConfig: function ( name, config ) {
        this._configs[ name ] = config;
        if ( this.get( 'config' ) === name ) {
            this._configDidChange();
        }
        return this;
    },

    _render: function ( layer ) {
        // Create left and right container.
        var el = NS.Element.create,
            all = this._all = el( 'div' ),
            config = this._configs[ this.get( 'config' ) ],
            standardConfig = this._configs.standard,
            isInDocument = this.get( 'isInDocument' ),
            divider = el( 'span.divider' ),
            views = this._views,
            childViews = [],
            sections, i, l, conf, container, viewName, view;

        // Insert views specified + dividers
        sections = 2;
        while ( sections-- ) {
            conf = sections ? ( config && config.left ) || standardConfig.left :
                ( config && config.right ) || standardConfig.right;
            container = el( 'div.' + ( sections ? 'left' : 'right' ) );
            for ( i = 0, l = conf.length; i < l; i += 1 ) {
                viewName = conf[i];
                if ( viewName === '-' ) {
                    container.appendChild( divider.cloneNode( false ) );
                } else {
                    view = views[ viewName ].set( 'parentView', this ).render();
                    if ( isInDocument ) {
                        view.willAppendLayerToDocument();
                    }
                    container.appendChild( view.get( 'layer' ) );
                    childViews.push( view );
                }
            }
            all.appendChild( container );
        }

        layer.appendChild( all );

        if ( isInDocument ) {
            for ( i = 0, l = childViews.length; i < l; i += 1 ) {
                childViews[i].didAppendLayerToDocument();
            }
            this._viewDidResize();
        }

        this.set( 'childViews', childViews );
    },

    _configDidChange: function ( _, key, oldConfig ) {
        var config = this.get( 'config' );
        if ( config === oldConfig || !this.get( 'isRendered' ) ) {
            return;
        }

        var oldViews = this.get( 'childViews' ),
            isInDocument = this.get( 'isInDocument' ),
            layer = this.get( 'layer' ),
            l, newViews, view;

        if ( isInDocument ) {
            l = oldViews.length;
            while ( l-- ) {
                oldViews[l].willRemoveLayerFromDocument();
            }
        }

        layer.removeChild( this._all );

        if ( isInDocument ) {
            l = oldViews.length;
            while ( l-- ) {
                oldViews[l].didRemoveLayerFromDocument();
            }
        }

        this._render( layer );

        // And patch up view states.
        newViews = this.get( 'childViews' );
        l = oldViews.length;
        while ( l-- ) {
            view = oldViews[l];
            if ( newViews.indexOf( view ) === -1 ) {
                view.set( 'parentView', null );
            }
        }
    }.observes( 'config' ),

    toolbarIsTooNarrow: function () {},

    _viewDidResize: function () {
        if ( !this.get( 'isInDocument' ) ) { return; }
        // Calculate gap between left and right.
        var width = this.get( 'pxWidth' ),
            layer = this.get( 'layer' ),
            left = layer.firstChild.offsetWidth,
            right = layer.lastChild.offsetWidth,
            gap = width - left - right;

        // If there's overlap, inform the controller.
        if ( gap < 0 ) {
            this.toolbarIsTooNarrow( gap );
        }
    }.observes( 'pxWidth' )
});

NS.ToolbarView = ToolbarView;

}( this.O ) );

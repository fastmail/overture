// -------------------------------------------------------------------------- \\
// File: ToolbarView.js                                                       \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var toView = function ( name ) {
    return ( name === '-' ) ?
        NS.Element.create( 'span.divider' ) :
        this._views[ name ];
};

var ToolbarView = NS.Class({

    Extends: NS.View,

    className: 'ToolbarView',

    config: 'standard',
    minimumGap: 20,
    preventOverlap: false,

    init: function ( options ) {
        ToolbarView.parent.init.call( this, options );
        this._views = {
            overflow: new NS.MenuButtonView({
                label: NS.loc( 'More' ),
                popOverView: options.popOverView || new NS.PopOverView()
            })
        };
        this._configs = {
            standard: {
                left: [],
                right: []
            }
        };
    },

    registerView: function ( name, view ) {
        this._views[ name ] = view;
        return this;
    },

    registerViews: function ( views ) {
        for ( var name in views ) {
            this.registerView( name, views[ name ] );
        }
        return this;
    },

    registerConfig: function ( name, config ) {
        this._configs[ name ] = config;
        if ( this.get( 'config' ) === name ) {
            this.propertyDidChange( 'config' );
        }
        return this;
    },

    registerConfigs: function ( configs ) {
        for ( var name in configs ) {
            this.registerConfig( name, configs[ name ] );
        }
        return this;
    },

    // ---

    leftConfig: function () {
        var configs = this._configs;
        return configs[ this.get( 'config' ) ].left ||
            configs.standard.left;
    }.property( 'config' ),

    rightConfig: function () {
        var configs = this._configs;
        return configs[ this.get( 'config' ) ].right ||
            configs.standard.right;
    }.property( 'config' ),

    left: function () {
        var leftConfig = this.get( 'leftConfig' ),
            rightConfig = this.get( 'rightConfig' ),
            pxWidth = this.get( 'pxWidth' ),
            widths = this._widths,
            i, l;

        if ( widths && pxWidth && this.get( 'preventOverlap' ) ) {
            pxWidth -= this.get( 'minimumGap' );
            for ( i = 0, l = rightConfig.length; i < l; i += 1 ) {
                pxWidth -= widths[ rightConfig[i] ];
            }
            for ( i = 0, l = leftConfig.length; i < l; i += 1 ) {
                pxWidth -= widths[ leftConfig[i] ];
            }
            if ( pxWidth < 0 ) {
                pxWidth -= widths[ '-' ];
                pxWidth -= widths.overflow;

                while ( pxWidth < 0 && l-- ) {
                    pxWidth += widths[ leftConfig[l] ];
                }
                if ( l < 0 ) { l = 0; }

                this._views.overflow.set( 'menuView', new NS.MenuView({
                    showFilter: false,
                    options: leftConfig.slice( l ).map( toView, this ).filter(
                        function ( view ) {
                            return view instanceof NS.View;
                        }
                    )
                }) );

                if ( l > 0 ) {
                    if ( leftConfig[ l - 1 ] === '-' ) {
                        l -= 1;
                    }
                    leftConfig = leftConfig.slice( 0, l );
                    leftConfig.push( '-' );
                    leftConfig.push( 'overflow' );
                } else {
                    leftConfig = [ 'overflow' ];
                    l = 0;
                }
            }
        }
        return leftConfig.map( toView, this );
    }.property( 'leftConfig', 'rightConfig', 'pxWidth' ),

    right: function () {
        return this.get( 'rightConfig' ).map( toView, this );
    }.property( 'rightConfig' ),

    willAppendLayerToDocument: function () {
        var Element = NS.Element,
            el = Element.create,
            prevView = Element.forView( this );
        Element.appendChildren( this.get( 'layer' ),
            el( 'div.measure', [ this._unused =
                Object.values( this._views ).filter( function ( view ) {
                    return !view.get( 'parentView' );
                }),
                el( 'span.divider' )
            ])
        );
        Element.forView( prevView );
        ToolbarView.parent.willAppendLayerToDocument.call( this );
    },

    didAppendLayerToDocument: function () {
        this.beginPropertyChanges();
        ToolbarView.parent.didAppendLayerToDocument.call( this );

        var widths = this._widths = {},
            views = this._views,
            unused = this._unused,
            layer = this.get( 'layer' ),
            container = layer.lastChild,
            name;

        for ( name in views ) {
            widths[ name ] = views[ name ].get( 'pxWidth' );
        }
        widths[ '-' ] = container.lastChild.offsetWidth;

        unused.forEach( function ( view ) {
            this.removeView( view );
        }, this );
        delete this._unused;
        layer.removeChild( container );

        this.endPropertyChanges();
    },

    _render: function ( layer ) {
        var Element = NS.Element,
            el = Element.create;
        Element.appendChildren( layer, [
            el( 'div.left',
                this.get( 'left' )
            ),
            el( 'div.right', [
                this.get( 'right' )
            ])
        ]);
    },

    redraw: function ( _, side, oldViews ) {
        if ( this.get( 'isRendered' ) ) {
            var container = this.get( 'layer')[
                    side === 'left' ? 'firstChild' : 'lastChild'
                ],
                newViews = this.get( side ),
                View = NS.View,
                start = 0,
                isEqual = true,
                i, l, view;

            for ( i = start, l = oldViews.length; i < l; i += 1 ) {
                view = oldViews[i];
                if ( view instanceof View ) {
                    if ( isEqual && view === newViews[i] ) {
                        start += 1;
                    } else {
                        isEqual = false;
                        this.removeView( view );
                    }
                } else {
                    if ( isEqual ) {
                        start += 1;
                        newViews[i] = view;
                    } else {
                        container.removeChild( view );
                    }
                }
            }
            for ( i = start, l = newViews.length; i < l; i += 1 ) {
                view = newViews[i];
                if ( view instanceof View ) {
                    this.insertView( view, container );
                } else {
                    container.appendChild( view );
                }
            }
        }
    }.observes( 'left', 'right' )
});

NS.ToolbarView = ToolbarView;

}( this.O ) );

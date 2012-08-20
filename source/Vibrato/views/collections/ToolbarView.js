// -------------------------------------------------------------------------- \\
// File: ToolbarView.js                                                       \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js, ButtonView.js                    \\
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

var OverflowMenuView = NS.Class({

    Extends: NS.MenuButtonView,

    didAppendLayerToDocument: function () {
        OverflowMenuView.parent.didAppendLayerToDocument.call( this );
        this.setShortcuts( null, '', {}, this.get( 'shortcuts' ) );
        return this;
    },

    willRemoveLayerFromDocument: function () {
        this.setShortcuts( null, '', this.get( 'shortcuts' ), {} );
        return OverflowMenuView.parent.willRemoveLayerFromDocument.call( this );
    },

    shortcuts: function () {
        var views = this.getFromPath( 'menuView.options' );
        return views ? views.reduce( function ( acc, view ) {
            var shortcut = view.get( 'shortcut' );
            if ( shortcut ) {
                shortcut.split( ' ' ).forEach( function ( key ) {
                    acc[ key ] = view;
                });
            }
            return acc;
        }, {} ) : {};
    }.property( 'menuView' ),

    setShortcuts: function ( _, __, oldShortcuts, shortcuts ) {
        if ( this.get( 'isInDocument' ) ) {
            var kbShortcuts = NS.RootViewController.kbShortcuts,
                key;
            if ( !shortcuts ) { shortcuts = this.get( 'shortcuts' ); }
            for ( key in oldShortcuts ) {
                kbShortcuts.deregister( key, this, 'activateButton' );
            }
            for ( key in shortcuts ) {
                kbShortcuts.register( key, this, 'activateButton' );
            }
        }
    }.observes( 'shortcuts' ),

    activateButton: function ( event ) {
        var key = NS.DOMEvent.lookupKey( event ),
            button = this.get( 'shortcuts' )[ key ];
        if ( button instanceof NS.MenuButtonView ) {
            this.activate();
        }
        button.activate();
    }
});

var ToolbarView = NS.Class({

    Extends: NS.View,

    className: 'ToolbarView',

    config: 'standard',
    minimumGap: 20,
    preventOverlap: false,

    init: function ( options ) {
        ToolbarView.parent.init.call( this, options );
        this._views = {
            overflow: new OverflowMenuView({
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

    registerView: function ( name, view, _dontMeasure ) {
        this._views[ name ] = view;
        if ( !_dontMeasure && this.get( 'isInDocument' ) &&
                this.get( 'preventOverlap' ) ) {
            this.preMeasure().postMeasure();
        }
        return this;
    },

    registerViews: function ( views ) {
        for ( var name in views ) {
            this.registerView( name, views[ name ], true );
        }
        if ( this.get( 'isInDocument' ) && this.get( 'preventOverlap' ) ) {
            this.preMeasure().postMeasure();
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

    getView: function ( name ) {
        return this._views[ name ];
    },

    // ---

    leftConfig: function () {
        var configs = this._configs,
            config = configs[ this.get( 'config' ) ];
        return ( config && config.left ) ||
            configs.standard.left;
    }.property( 'config' ),

    rightConfig: function () {
        var configs = this._configs,
            config = configs[ this.get( 'config' ) ];
        return ( config && config.right ) ||
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
                    options: leftConfig.slice( l )
                        .map( toView, this )
                        .filter( function ( view ) {
                            return view instanceof NS.View;
                        })
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

    preMeasure: function () {
        this.insertView( this._measureView =
            new NS.View({
                className: 'measure',
                layerStyles: {},
                childViews: Object.values( this._views )
                                  .filter( function ( view ) {
                    return !view.get( 'parentView' );
                }),
                _render: function ( layer ) {
                    layer.appendChild( NS.Element.create( 'span.divider' ) );
                    NS.View.prototype._render.call( this, layer );
                }
            })
        );
        return this;
    },

    postMeasure: function () {
        var widths = this._widths = {},
            views = this._views,
            measureView = this._measureView,
            unused = measureView.get( 'childViews' ),
            container = measureView.get( 'layer' ),
            containerBoundingClientRect = container.getBoundingClientRect(),
            firstButton = unused.length ? unused[0].get( 'layer' ) : null,
            name, l;

        for ( name in views ) {
            widths[ name ] = views[ name ].get( 'pxWidth' );
        }

        // Want to include any left/right margin, so get difference between
        // edge of first button and start of container
        widths[ '-' ] = ( firstButton ?
            firstButton.getBoundingClientRect().left :
            containerBoundingClientRect.right
        ) - containerBoundingClientRect.left;

        this.removeView( measureView );
        l = unused.length;
        while ( l-- ) {
            measureView.removeView( unused[l] );
        }
        measureView.destroy();
        delete this._measureView;

        return this;
    },

    willAppendLayerToDocument: function () {
        if ( this.get( 'preventOverlap' ) ) {
            this.preMeasure();
        }
        return ToolbarView.parent.willAppendLayerToDocument.call( this );
    },

    didAppendLayerToDocument: function () {
        this.beginPropertyChanges();
        ToolbarView.parent.didAppendLayerToDocument.call( this );
        if ( this.get( 'preventOverlap' ) ) {
            this.postMeasure();
        }
        this.endPropertyChanges();
        return this;
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

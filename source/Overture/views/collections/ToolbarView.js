import { Class } from '../../core/Core.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/ObservableProps.js';  // For Function#observes
import { lookupKey } from '../../dom/DOMEvent.js';
import Element from '../../dom/Element.js';
import { loc } from '../../localisation/LocaleController.js';
import View from '../View.js';
import ViewEventsController from '../ViewEventsController.js';
import PopOverView from '../panels/PopOverView.js';
import MenuButtonView from '../controls/MenuButtonView.js';
import MenuView from '../controls/MenuView.js';

const toView = function ( name ) {
    return ( name === '-' ) ?
        Element.create( 'span.v-Toolbar-divider' ) :
        this._views[ name ];
};

const OverflowMenuView = Class({

    Extends: MenuButtonView,

    didEnterDocument () {
        OverflowMenuView.parent.didEnterDocument.call( this );
        this.setShortcuts( null, '', {}, this.get( 'shortcuts' ) );
        return this;
    },

    willLeaveDocument () {
        this.setShortcuts( null, '', this.get( 'shortcuts' ), {} );
        return OverflowMenuView.parent.willLeaveDocument.call( this );
    },

    shortcuts: function () {
        const views = this.getFromPath( 'menuView.options' );
        return views ? views.reduce( ( acc, view ) => {
            const shortcut = view.get( 'shortcut' );
            if ( shortcut ) {
                shortcut.split( ' ' ).forEach( key => {
                    acc[ key ] = view;
                });
            }
            return acc;
        }, {} ) : {};
    }.property( 'menuView' ),

    setShortcuts: function ( _, __, oldShortcuts, shortcuts ) {
        if ( this.get( 'isInDocument' ) ) {
            const kbShortcuts = ViewEventsController.kbShortcuts;
            if ( !shortcuts ) { shortcuts = this.get( 'shortcuts' ); }
            for ( const key in oldShortcuts ) {
                kbShortcuts.deregister( key, this, 'activateButton' );
            }
            for ( const key in shortcuts ) {
                kbShortcuts.register( key, this, 'activateButton' );
            }
        }
    }.observes( 'shortcuts' ),

    activateButton ( event ) {
        const key = lookupKey( event );
        const button = this.get( 'shortcuts' )[ key ];
        if ( button instanceof MenuButtonView ) {
            this.activate();
        }
        button.activate();
    },
});

const ToolbarView = Class({

    Extends: View,

    className: 'v-Toolbar',

    config: 'standard',
    minimumGap: 20,
    preventOverlap: false,

    init ( mixin ) {
        ToolbarView.parent.init.call( this, mixin );
        this._views = {
            overflow: new OverflowMenuView({
                label: loc( 'More' ),
                popOverView: mixin.popOverView || new PopOverView(),
            }),
        };
        this._configs = {
            standard: {
                left: [],
                right: [],
            },
        };
        this._measureView = null;
        this._widths = {};
    },

    registerView ( name, view, _dontMeasure ) {
        this._views[ name ] = view;
        if ( !_dontMeasure && this.get( 'isInDocument' ) &&
                this.get( 'preventOverlap' ) ) {
            this.preMeasure().postMeasure();
        }
        return this;
    },

    registerViews ( views ) {
        for ( const name in views ) {
            this.registerView( name, views[ name ], true );
        }
        if ( this.get( 'isInDocument' ) && this.get( 'preventOverlap' ) ) {
            this.preMeasure().postMeasure();
        }
        return this;
    },

    registerConfig ( name, config ) {
        this._configs[ name ] = config;
        if ( this.get( 'config' ) === name ) {
            this.computedPropertyDidChange( 'config' );
        }
        return this;
    },

    registerConfigs ( configs ) {
        for ( const name in configs ) {
            this.registerConfig( name, configs[ name ] );
        }
        return this;
    },

    getView ( name ) {
        return this._views[ name ];
    },

    getConfig ( config ) {
        return this._configs[ config ] || null;
    },

    // ---

    leftConfig: function () {
        const configs = this._configs;
        const config = configs[ this.get( 'config' ) ];
        return ( config && config.left ) || configs.standard.left;
    }.property( 'config' ),

    rightConfig: function () {
        const configs = this._configs;
        const config = configs[ this.get( 'config' ) ];
        return ( config && config.right ) || configs.standard.right;
    }.property( 'config' ),

    left: function () {
        let leftConfig = this.get( 'leftConfig' );
        const rightConfig = this.get( 'rightConfig' );
        let pxWidth = this.get( 'pxWidth' );
        const widths = this._widths;
        let i, l;

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

                this._views.overflow.set( 'menuView', new MenuView({
                    showFilter: false,
                    options: leftConfig.slice( l )
                        .map( toView, this )
                        .filter( view => view instanceof View ),
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

    preMeasure () {
        this.insertView( this._measureView =
            new View({
                className: 'v-Toolbar-section v-Toolbar-section--measure',
                layerStyles: {},
                childViews: Object.values( this._views )
                                  .filter( view => !view.get( 'parentView' ) ),
                draw ( layer, Element, el ) {
                    return [
                        el( 'span.v-Toolbar-divider' ),
                        View.prototype.draw.call( this, layer, Element, el ),
                    ];
                },
            }),
            this.get( 'layer' ).lastChild,
            'before'
        );
        return this;
    },

    postMeasure () {
        const widths = this._widths;
        const views = this._views;
        const measureView = this._measureView;
        const unused = measureView.get( 'childViews' );
        const container = measureView.get( 'layer' );
        const containerBoundingClientRect = container.getBoundingClientRect();
        const firstButton = unused.length ? unused[0].get( 'layer' ) : null;

        for ( const name in views ) {
            widths[ name ] = views[ name ].get( 'pxWidth' ) || widths[ name ];
        }

        // Want to include any left/right margin, so get difference between
        // edge of first button and start of container
        widths[ '-' ] = ( firstButton ?
            firstButton.getBoundingClientRect().left :
            containerBoundingClientRect.right
        ) - containerBoundingClientRect.left;

        this.removeView( measureView );
        let l = unused.length;
        while ( l-- ) {
            measureView.removeView( unused[l] );
        }
        measureView.destroy();
        this._measureView = null;

        return this;
    },

    willEnterDocument () {
        if ( this.get( 'preventOverlap' ) ) {
            this.preMeasure();
        }
        return ToolbarView.parent.willEnterDocument.call( this );
    },

    didEnterDocument () {
        this.beginPropertyChanges();
        ToolbarView.parent.didEnterDocument.call( this );
        if ( this.get( 'preventOverlap' ) ) {
            this.postMeasure();
        }
        this.endPropertyChanges();
        return this;
    },

    draw ( layer, Element, el ) {
        return [
            el( 'div.v-Toolbar-section.v-Toolbar-section--left',
                this.get( 'left' )
            ),
            el( 'div.v-Toolbar-section.v-Toolbar-section--right',
                this.get( 'right' )
            ),
        ];
    },

    toolbarNeedsRedraw: function ( self, property, oldValue ) {
        if ( oldValue ) {
            this.propertyNeedsRedraw( self, property, oldValue );
        }
    }.observes( 'left', 'right' ),

    redrawLeft ( layer, oldViews ) {
        this.redrawSide( layer.firstChild, oldViews, this.get( 'left' ) );
    },
    redrawRight ( layer, oldViews ) {
        this.redrawSide( layer.lastChild, oldViews, this.get( 'right' ) );
    },

    redrawSide ( container, oldViews, newViews ) {
        let start = 0,
            isEqual = true,
            i, l, view, parent;

        for ( i = start, l = oldViews.length; i < l; i += 1 ) {
            view = oldViews[i];
            if ( view instanceof View ) {
                if ( isEqual && view === newViews[i] ) {
                    start += 1;
                } else {
                    isEqual = false;
                    // Check it hasn't already swapped sides!
                    if ( view.get( 'layer' ).parentNode === container ) {
                        this.removeView( view );
                    }
                }
            } else {
                if ( isEqual && !( newViews[i] instanceof View ) ) {
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
                if ( parent = view.get( 'parentView' ) ) {
                    parent.removeView( view );
                }
                this.insertView( view, container );
            } else {
                container.appendChild( view );
            }
        }
    },
});

export default ToolbarView;

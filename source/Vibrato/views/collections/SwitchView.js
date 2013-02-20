// -------------------------------------------------------------------------- \\
// File: SwitchView.js                                                        \\
// Module: View                                                               \\
// Requires: Core, Foundation, View.js                                        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

var View = NS.View;
var Element = NS.Element;

var forEachView = function ( views, method, args ) {
    var l = views ? views.length : 0,
        view;
    while ( l-- ) {
        view = views[l];
        if ( view instanceof View ) {
            if ( args ) {
                view[ method ].apply( view, args );
            } else {
                view[ method ]();
            }
        }
    }
};

var SwitchView = NS.Class({

    Extends: View,

    init: function ( mixin ) {
        this.views = [];
        this.subViews = [];

        SwitchView.parent.init.call( this, mixin );

        var views = this.get( 'views' ),
            l = views.length,
            view;
        while ( l-- ) {
            view = views[l];
            if ( view && !( view instanceof Array ) ) {
                views[l] = [ view ];
            }
        }
    },

    destroy: function () {
        var views = this.get( 'views' ),
            l = views.length;
        while ( l-- ) {
            forEachView( views[l], 'destroy' );
        }
        views = this.get( 'subViews' );
        l = views.length;
        while ( l-- ) {
            forEachView( views[l], 'destroy' );
        }
        SwitchView.parent.destroy.call( this );
    },

    // ---

    sleep: function () {
        if ( !this.isSleeping ) {
            this.suspendBindings();
            this.isSleeping = true;
        }
        return this;
    },

    awaken: function () {
        if ( this.isSleeping ) {
            this.isSleeping = false;
            this.resumeBindings();
        }
        return this;
    },

    // ---

    isRendered: true,

    layer: function () {
        return document.createComment( 'SwitchView ' + this.get( 'id' ) );
    }.property(),

    willAppendLayerToDocument: function () {
        return this;
    },

    didAppendLayerToDocument: function () {
        return this.set( 'isInDocument', true );
    },

    willRemoveLayerFromDocument: function () {
        return this.set( 'isInDocument', false );
    },

    didRemoveLayerFromDocument: function () {
        return this;
    },

    // ---

    _index: 0,
    index: 0,

    indexDidChange: function () {
        if ( this.get( 'index' ) !== this._index ) {
            var parentView = this.get( 'parentView' );
            if ( parentView ) {
                this.remove( parentView ).add();
            }
        }
    }.queue( 'render' ).observes( 'index' ),

    parentViewDidChange: function ( _, __, oldParent, newParent ) {
        if ( oldParent ) {
            this.remove( oldParent );
        }
        if ( newParent ) {
            if ( newParent.get( 'isRendered' ) ) {
                // We need to wait until we've been inserted to know where our
                // DOM marker has been place, and so where to insert the real
                // view(s).
                newParent.addObserverForKey( 'childViews', this, 'add' );
            } else {
                // If not rendered, just add our views in the right place in the
                // parent's childView list. They'll be rendered in the right
                // spot.
                this.add();
            }
        }
    }.observes( 'parentView' ),

    add: function ( object, key ) {
        if ( object ) {
            object.removeObserverForKey( key, this, 'add' );
        }
        var index = this.get( 'index' ),
            view = this.get( 'views' )[ index ],
            subView = this.get( 'subViews' )[ index ],
            parent = this.get( 'parentView' ),
            isInDocument = this.get( 'isInDocument' ),
            position = this.get( 'layer' ),
            layer = position.parentNode,
            l = view ? view.length : 0,
            node, before;

        forEachView( view, 'awaken' );
        if ( subView ) {
            forEachView( subView, 'awaken' );
            forEachView( subView, 'set', [ 'parentView', parent ] );
            if ( isInDocument ) {
                forEachView( subView, 'willAppendLayerToDocument' );
            }
        }
        while ( l-- ) {
            node = view[l];
            if ( node instanceof View ) {
                parent.insertView( node, this, 'after' );
            } else {
                if ( typeof node !== 'object' ) {
                    node = view[l] = document.createTextNode( node );
                }
                before = position.nextSibling;
                if ( before ) {
                    layer.insertBefore( node, before );
                } else {
                    layer.appendChild( node );
                }
            }
        }
        if ( subView ) {
            if ( isInDocument ) {
                forEachView( subView, 'didAppendLayerToDocument' );
            }
            parent.set( 'childViews',
                parent.get( 'childViews' ).concat( subView ) );
        }
        this._index = index;
        return this;
    },

    remove: function ( parent ) {
        var oldIndex = this._index,
            view = this.get( 'views' )[ oldIndex ],
            subView = this.get( 'subViews' )[ oldIndex ],
            isInDocument = this.get( 'isInDocument' ),
            l = view ? view.length : 0,
            node;

        if ( isInDocument && subView ) {
            forEachView( subView, 'willRemoveLayerFromDocument' );
        }
        while ( l-- ) {
            node = view[l];
            if ( node instanceof View ) {
                parent.removeView( node );
            } else {
                node.parentNode.removeChild( node );
            }
        }
        if ( subView ) {
            if ( isInDocument ) {
                forEachView( subView, 'didRemoveLayerFromDocument' );
            }
            forEachView( subView, 'set', [ 'parentView', null ] );
            parent.set( 'childViews',
                parent.get( 'childViews' ).filter( function ( view ) {
                    return subView.indexOf( view ) === -1;
                })
            );
            forEachView( subView, 'sleep' );
        }
        forEachView( view, 'sleep' );
        this._index = -1;
        return this;
    },

    // ---

    /*
        If views are inside el() methods, they will call this method. Collect
        them up, then pass them as subViews when show() or otherwise() is
        called.
    */
    insertView: function ( view, parentNode ) {
        this.childViews.push( view );
        var oldParent = view.get( 'parentView' );
        if ( oldParent ) {
            oldParent.removeView( view );
        }
        parentNode.appendChild( view.render().get( 'layer' ) );
        return this;
    },

    _addCondition: function ( view, index ) {
        view = view ?
            view instanceof Array ?
                view :
                [ view ] :
            null;
        forEachView( this.views[ index ] = view, 'sleep' );
        var subView = this.childViews;
        if ( subView.length ) {
            forEachView( subView, 'sleep' );
            this.subViews[ index ] = subView;
            this.childViews = [];
        }
        return this;
    },

    show: function ( view ) {
        return this._addCondition( view, 0 );
    },

    otherwise: function ( view ) {
        return this._addCondition( view, 1 );
    },

    end: function () {
        Element.forView( this._oldView );
        this._oldView = null;
        return this;
    }
});

NS.SwitchView = SwitchView;

var pickViewWhen = function ( bool ) {
    return bool ? 0 : 1;
};
var pickViewUnless = function ( bool ) {
    return bool ? 1 : 0;
};

var createView = function ( object, property, transform ) {
    var switchView = new SwitchView({
        index: NS.bind( property, object, transform )
    });
    switchView._oldView = Element.forView( switchView );
    return switchView;
};

Element.when = function ( object, property ) {
    return createView( object, property, pickViewWhen );
};
Element.unless = function ( object, property ) {
    return createView( object, property, pickViewUnless );
};

}( this.O ) );

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

var forEachView = function ( views, method ) {
    if ( views ) {
        if ( !( views instanceof Array ) ) {
            views = [ views ];
        }
        var l = views.length,
            view;
        while ( l-- ) {
            view = views[l];
            if ( view instanceof View ) {
                view[ method ]();
            }
        }
    }
};

var SwitchView = NS.Class({

    Extends: View,

    forEachView: function ( method ) {
        var views = this.get( 'views' ),
            l = views.length;
        while ( l-- ) {
            forEachView( views[l], method );
        }
    },

    destroy: function () {
        this.forEachView( 'destroy' );
        SwitchView.parent.destroy.call( this );
    },

    // ---

    sleep: function () {
        if ( !this.isSleeping ) {
            this.suspendBindings();
            this.forEachView( 'sleep' );
            this.isSleeping = true;
        }
        return this;
    },

    awaken: function () {
        if ( this.isSleeping ) {
            this.isSleeping = false;
            this.forEachView( 'awaken' );
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

    views: [],
    index: 0,

    _insertedView: null,
    _activeView: null,
    activeView: function () {
        return this.get( 'views' ).getObjectAt( this.get( 'index' ) );
    }.property( 'views', 'index' ),

    activeViewDidChange: function () {
        if ( this.get( 'activeView' ) !== this._activeView ) {
            this.remove( this.get( 'parentView' ) ).add();
        }
    }.queue( 'render' ).observes( 'activeView' ),

    parentViewDidChange: function ( _, __, oldParent, newParent ) {
        if ( oldParent ) {
            this.remove( oldParent );
        }
        if ( newParent ) {
            if ( newParent.get( 'isRendered' ) ) {
                newParent.addObserverForKey( 'childViews', this, 'add' );
            } else {
                this.add();
            }
        }
    }.observes( 'parentView' ),

    add: function ( object, key ) {
        if ( object ) {
            object.removeObserverForKey( key, this, 'add' );
        }
        var activeView = this.get( 'activeView' ),
            viewList = activeView ?
                activeView instanceof Array ?
                    activeView :
                    [ activeView ] :
                null,
            parent = this.get( 'parentView' ),
            position = this.get( 'layer' ),
            layer = position.parentNode,
            l = viewList ? viewList.length : 0,
            node, before;
        forEachView( viewList, 'awaken' );
        while ( l-- ) {
            node = viewList[l];
            if ( node instanceof View ) {
                parent.insertView( node, this, 'after' );
            } else {
                if ( typeof node !== 'object' ) {
                    node = viewList[l] = document.createTextNode( node );
                }
                before = position.nextSibling;
                if ( before ) {
                    layer.insertBefore( node, before );
                } else {
                    layer.appendChild( node );
                }
            }
        }
        this._activeView = activeView;
        this._insertedView = viewList;
        return this;
    },

    remove: function ( parent ) {
        var viewList = this._insertedView,
            l = viewList ? viewList.length : 0,
            node;
        while ( l-- ) {
            node = viewList[l];
            if ( node instanceof View ) {
                parent.removeView( node );
            } else {
                node.parentNode.removeChild( node );
            }
        }
        forEachView( viewList, 'sleep' );
        this._insertedView = null;
        this._activeView = null;
        return this;
    },

    // ---

    otherwise: function ( view ) {
        this.views[1] = view || null;
        forEachView( view, 'sleep' );
        return this;
    }
});

NS.SwitchView = SwitchView;

var pickView = function ( bool ) {
    return bool ? 0 : 1;
};

NS.Element.when = function ( object, property, view ) {
    forEachView( view, 'sleep' );
    return new SwitchView({
        views: [ view, null ],
        index: NS.bind( property, object, pickView )
    });
};

}( this.O ) );

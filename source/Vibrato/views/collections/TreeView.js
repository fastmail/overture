// -------------------------------------------------------------------------- \\
// File: TreeView.js                                                          \\
// Module: CollectionViews                                                    \\
// Requires: CollectionView.js                                                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global OperaMail */

"use strict";

( function ( NS ) {

var ExpandoView = NS.Class({

    Extends: NS.View,

    positioning: 'absolute',
    layout: {
        top: 0
    },

    className: function () {
        return 'ExpandoView' + ( this.get( 'isCollapsed' ) ? '' : ' expanded' );
    }.property( 'isCollapsed' ),

    isCollapsed: NS.bindTwoWay( 'parentView.isCollapsed' ),

    label: '',

    draw: function ( layer ) {
        var label = this.get( 'label' );
        layer.appendChild( NS.Element.create( 'span', {
            text: label
        }) );
        layer.title = label;
    },

    toggleCollapsed: function () {
        this.toggle( 'isCollapsed' );
    }.on( 'click' )
});

var TreeItemView = NS.Class({

    Extends: NS.View,

    layerTag: 'li',

    parentTreeItemView: function () {
        return this.get( 'parentView' ).get( 'treeItemView' );
    }.property(),

    treeView: function () {
        return this.get( 'parentView' ).get( 'treeView' );
    }.property(),

    init: function () {
        TreeItemView.parent.init.apply( this, arguments );

        // Inform parent it's got a new visible child
        var parent = this.get( 'parentTreeItemView' );
        if ( parent ) { parent.increment( 'visibleChildren', 1 ); }

        // And then check whether we're really hidden.
        this.visibilityMayHaveChanged();

        // Setup binding to detect change in subtree presence:
        var treeView = this.get( 'treeView' ),
            data = this.get( 'content' );

        this.registerBinding( new NS.Binding({
                transform: NS.Transform.toBoolean
            }).from( treeView.get( 'subContentProp' ) + '.length', data )
              .to( 'hasSubtree', this )
              .connect()
        );

        // And register with the tree view.
        treeView.register( this );
    },
    destroy: function () {
        if ( this._isVisible ) {
            var parent = this.get( 'parentTreeItemView' );
            if ( parent ) { parent.increment( 'visibleChildren', -1 ); }
        }
        this.get( 'treeView' ).deregister( this );
        TreeItemView.parent.destroy.call( this );
    },

    // --- Visibility ---

    isHidden: false,
    visibleChildren: 0,
    _isVisible: true,
    visibilityMayHaveChanged: function () {
        var isVisible =
            !this.get( 'isHidden' ) || !!this.get( 'visibleChildren' );
        if ( isVisible !== this._isVisible ) {
            var parent = this.get( 'parentTreeItemView' );
            if ( parent ) {
                parent.increment( 'visibleChildren', isVisible ? 1 : -1 );
            }
            this._isVisible = isVisible;
        }
    }.observes( 'isHidden', 'visibleChildren' ),

    // ---

    isSelected: false,
    isCollapsed: false,

    hasSubtree: false,

    depth: function () {
        var parent = this.get( 'parentTreeItemView' );
        return parent ? parent.get( 'depth' ) + 1 : 0;
    }.property( 'parentTreeItemView' ),

    className: function () {
        return 'TreeItemView depth' + this.get( 'depth' ) +
            ( this.get( 'isSelected' ) ? ' selected' : '' ) +
            ( this.get( 'isHidden' ) ? ( this.get( 'visibleChildren' ) ?
                ' hiddenButChildren' : ' hidden' ) : '' );
    }.property( 'isSelected', 'isHidden', 'visibleChildren', 'depth' ),

    _expandCollapse: function () {
        if ( this.get( 'isRendered' ) && this.get( 'hasSubtree' ) ) {
            var subview = this.get( 'subView' );
            if ( this.get( 'isCollapsed' ) ) {
                this.removeView( subview );
            } else {
                this.insertView( subview );
            }
        }
    }.observes( 'isCollapsed' ),

    subView: function () {
        return new NS.CollectionView({
            layerTag: 'ul',
            content: this.get( 'content' ).get(
                this.get( 'treeView' ).get( 'subContentProp' ) ),
            ItemView: this.constructor,
            treeView: this.get( 'treeView' ),
            treeItemView: this
        });
    }.property(),

    expandoView: function () {
        return new ExpandoView();
    }.property(),

    hasSubtreeDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            var action = this.get( 'hasSubtree' ) ? 'insertView' : 'removeView';
            if ( this.get( 'treeView' ).get( 'isCollapsible' ) ) {
                this[ action ]( this.get( 'expandoView' ) );
            }
            if ( !this.get( 'isCollapsed' ) ) {
                this[ action ]( this.get( 'subView' ) );
            }
        }
    }.queue( 'render' ).observes( 'hasSubtree' ),

    draw: function ( layer ) {
        var data = this.get( 'content' ),
            treeView = this.get( 'treeView' ),
            ContentView = treeView.get( 'ContentView' );

        this.insertView( new ContentView({
            content: data
        }) );

        if ( this.get( 'hasSubtree' ) ) {
            if ( treeView.get( 'isCollapsible' ) ) {
                this.insertView( this.get( 'expandoView' ) );
            }
            if ( !this.get( 'isCollapsed' ) ) {
                this.insertView( this.get( 'subView' ) );
            }
        }
    }
});

var TreeView = NS.Class({

    Extends: NS.View,

    className: 'TreeView',

    subContentProp: 'subfolders',

    ItemView: TreeItemView,
    ContentView: NS.View,

    isCollapsible: true,

    init: function () {
        TreeView.parent.init.apply( this, arguments );
        this.treeItemViews = [];
        this._treeItemIndex = {};
    },

    _selectedView: null,
    selectedItem: null,

    selectedItemDidChange: function () {
        var item = this.get( 'selectedItem' ),
            selected = ( item &&
                this._treeItemIndex[ item.get( 'storeKey' ) ] ) || null;
        if ( this._selectedView !== selected ) {
            if ( this._selectedView ) {
                this._selectedView.set( 'isSelected', false );
            }
            if ( selected ) {
                selected.set( 'isSelected', true );
            }
            this._selectedView = selected;
        }
    }.observes( 'selectedItem' ),

    register: function ( view ) {
        var item = view.get( 'content' );
        this._treeItemIndex[ item.get( 'storeKey' ) ] = view;
        this.get( 'treeItemViews' ).push( view );

        if ( this.get( 'selectedItem' ) === item ) {
            this._selectedView = view.set( 'isSelected', true );
        }
    },
    deregister: function ( view ) {
        delete this._treeItemIndex[ view.get( 'content' ).get( 'storeKey' ) ];
        var viewlist = this.get( 'treeItemViews' );
        viewlist.splice( viewlist.indexOf( view ), 1 );
    },

    draw: function () {
        this.insertView( new NS.CollectionView({
            layerTag: 'ul',
            content: this.get( 'content' ),
            ItemView: this.get( 'ItemView' ),
            treeView: this,
            treeItemView: null
        }) );
    }
});

NS.ExpandoView = ExpandoView;
NS.TreeItemView = TreeItemView;
NS.TreeView = TreeView;

}( this.O ) );
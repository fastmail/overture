// -------------------------------------------------------------------------- \\
// File: SwitchView.js                                                        \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View, DOM                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global document */

import { Class } from '../../core/Core.js';
import { bind } from '../../foundation/Binding.js';
import RunLoop from '../../foundation/RunLoop.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/ObservableProps.js';  // For Function#observes
import View from '../View.js';
import Element from '../../dom/Element.js';

var forEachView = function ( views, method, args ) {
    var l = views ? views.length : 0,
        view;
    while ( l-- ) {
        view = views[l];
        if ( view instanceof View && !view.isDestroyed ) {
            if ( args ) {
                view[ method ].apply( view, args );
            } else {
                view[ method ]();
            }
        }
    }
};

var flattenAndPrune = function ( array, node ) {
    if ( node instanceof Array ) {
        node.reduce( flattenAndPrune, array );
    } else if ( node ) {
        array.push( node );
    }
    return array;
};

var SwitchView = Class({

    Extends: View,

    init: function ( mixin ) {
        this._oldView = null;
        // -1 => Not added views to parent
        // Otherwise => Index of view(s) currently in parent
        this._index = -1;

        // Index of view that should be in parent.
        this.index = 0;
        this.views = [];
        this.subViews = [];

        SwitchView.parent.init.call( this, mixin );

        this.isRendered = true;

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

    layer: function () {
        return document.createComment( 'SwitchView ' + this.get( 'id' ) );
    }.property(),

    willEnterDocument: function () {
        this.resumeBindings();
        this.redraw();
        return this;
    },

    didEnterDocument: function () {
        if ( this.get( 'index' ) !== this._index ) {
            this.switchNeedsRedraw();
        }
        return this.set( 'isInDocument', true );
    },

    willLeaveDocument: function () {
        return this.set( 'isInDocument', false );
    },

    didLeaveDocument: function () {
        return this.suspendBindings();
    },

    // ---

    redraw: function () {
        var oldIndex = this._index,
            newIndex = this.get( 'index' ),
            parentView;
        // If not yet added to parent, nothing to redraw; _add will be called
        // automatically soon.
        if ( !this.isDestroyed && oldIndex > -1 && oldIndex !== newIndex ) {
            parentView = this.get( 'parentView' );
            if ( parentView ) {
                this._remove( parentView );
                this._add();
            }
        }
    },

    switchNeedsRedraw: function () {
        if ( this.get( 'isInDocument' ) ) {
            RunLoop.queueFn( 'render', this.redraw, this );
        }
    }.observes( 'index' ),

    parentViewDidChange: function ( _, __, oldParent, newParent ) {
        if ( oldParent ) {
            // May be a NOP, but just in case.
            oldParent.removeObserverForKey( 'childViews', this, '_add' );
            this._remove( oldParent );
        }
        if ( newParent ) {
            if ( newParent.get( 'isRendered' ) &&
                    !this.get( 'layer' ).parentNode ) {
                // We need to wait until we've been inserted to know where our
                // DOM marker has been place, and so where to insert the real
                // view(s).
                newParent.addObserverForKey( 'childViews', this, '_add' );
            } else {
                // If not rendered, just add our views in the right place in the
                // parent's childView list. They'll be rendered in the right
                // spot.
                this._add();
            }
        }
    }.observes( 'parentView' ),

    _add: function () {
        var index = this.get( 'index' ),
            views = this.get( 'views' )[ index ],
            subViews = this.get( 'subViews' )[ index ],
            parent = this.get( 'parentView' ),
            isInDocument = parent.get( 'isInDocument' ),
            position = this.get( 'layer' ),
            layer = position.parentNode,
            l, node, before;

        // May be a NOP, but just in case.
        parent.removeObserverForKey( 'childViews', this, '_add' );
        if ( this._index !== -1 ) {
            return;
        }
        this._index = index;

        if ( subViews ) {
            forEachView( subViews, 'set', [ 'parentView', parent ] );
            if ( isInDocument ) {
                forEachView( subViews, 'willEnterDocument' );
            }
        }

        l = views ? views.length : 0;
        while ( l-- ) {
            node = views[l];
            if ( node instanceof View ) {
                parent.insertView( node, this, 'after' );
            } else {
                if ( typeof node !== 'object' ) {
                    node = views[l] = document.createTextNode( node );
                }
                before = position.nextSibling;
                if ( before ) {
                    layer.insertBefore( node, before );
                } else {
                    layer.appendChild( node );
                }
            }
        }

        if ( subViews ) {
            if ( isInDocument ) {
                forEachView( subViews, 'didEnterDocument' );
            }
            Array.prototype.push.apply( parent.get( 'childViews' ), subViews );
            parent.propertyDidChange( 'childViews' );
        }
    },

    _remove: function ( parent ) {
        var oldIndex = this._index,
            views = this.get( 'views' )[ oldIndex ],
            subViews = this.get( 'subViews' )[ oldIndex ],
            isInDocument = parent.get( 'isInDocument' ),
            l, node, childViews, view, index, numToRemove;

        if ( isInDocument && subViews ) {
            forEachView( subViews, 'willLeaveDocument' );
        }

        l = views ? views.length : 0;
        while ( l-- ) {
            node = views[l];
            if ( node instanceof View ) {
                parent.removeView( node );
            } else {
                node.parentNode.removeChild( node );
            }
        }

        if ( subViews ) {
            if ( isInDocument ) {
                forEachView( subViews, 'didLeaveDocument' );
            }
            forEachView( subViews, 'set', [ 'parentView', null ] );
            childViews = parent.get( 'childViews' );
            l = subViews.length;
            while ( l-- ) {
                view = subViews[l];
                index = childViews.lastIndexOf( view );
                numToRemove = 1;
                if ( index > -1 ) {
                    while ( l > 0 && index > 0 &&
                            subViews[ l - 1 ] === childViews[ index - 1 ] ) {
                        l -= 1;
                        index -= 1;
                        numToRemove += 1;
                    }
                    childViews.splice( index, numToRemove );
                }
            }
            parent.propertyDidChange( 'childViews' );
        }
        this._index = -1;
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
        this.views[ index ] = view && view.reduce( flattenAndPrune, [] );
        var subViews = this.childViews;
        if ( subViews.length ) {
            this.subViews[ index ] = subViews;
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
    },
});

export default SwitchView;

var pickViewWhen = function ( bool ) {
    return bool ? 0 : 1;
};
var pickViewUnless = function ( bool ) {
    return bool ? 1 : 0;
};

var createView = function ( object, property, transform ) {
    var switchView = new SwitchView({
        index: bind( object, property, transform ),
    });
    switchView._oldView = Element.forView( switchView );
    return switchView;
};

Element.when = function ( object, property, transform ) {
    var pickView = transform ? function ( value, syncForward ) {
        return pickViewWhen( transform( value, syncForward ) );
    } : pickViewWhen;
    return createView( object, property, pickView );
};
Element.unless = function ( object, property, transform ) {
    var pickView = transform ? function ( value, syncForward ) {
        return pickViewUnless( transform( value, syncForward ) );
    } : pickViewUnless;
    return createView( object, property, pickView );
};

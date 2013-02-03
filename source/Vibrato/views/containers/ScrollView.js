// -------------------------------------------------------------------------- \\
// File: ScrollView.js                                                        \\
// Module: View                                                               \\
// Requires: Core, Foundation, View.js                                        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ScrollAnimation = NS.Class({

    Extends: NS.Animation,

    duration: 250,

    prepare: function ( coordinates ) {
        var object = this.object,
            startX = this.startX = object.get( 'scrollLeft' ),
            startY = this.startY = object.get( 'scrollTop' ),
            endX = this.endX = coordinates.x || 0,
            endY = this.endY = coordinates.y || 0,
            deltaX = this.deltaX = endX - startX,
            deltaY = this.deltaY = endY - startY;

        return !!( deltaX || deltaY );
    },

    drawFrame: function ( position ) {
        var x = position < 1 ?
                this.startX + ( position * this.deltaX ) : this.endY,
            y = position < 1 ?
                this.startY + ( position * this.deltaY ) : this.endY;
        this.object.scrollTo( x, y, false, true );
    }
});

/**
    Class: O.ScrollView

    Extends: O.View

    An O.ScrollView instance is a fixed size container, which can be scrolled if
    its contents overflows the bounds of the view. By default, a scrollbar will
    only be shown for vertical overflow. Set the <O.View#showScrollbarX>
    property to `true` to show a scrollbar on horizontal overflow as well.
*/
var ScrollView = NS.Class({

    Extends: NS.View,

    /**
        Property: O.ScrollView#className
        Type: String
        Default: 'ScrollView'

        Overrides default in O.View#className.
    */
    className: 'ScrollView',

    /**
        Property: O.ScrollView#clipToBounds
        Type: Boolean
        Default: true

        Overrides default in O.View#clipToBounds.
   */
    clipToBounds: true,
    /**
        Property: O.ScrollView#showScrollbarY
        Type: Boolean
        Default: true

        Overrides default in O.View#showScrollbarY
   */
    showScrollbarY: true,

    /**
        Property: O.ScrollView#positioning
        Type: String
        Default: 'absolute'

        Overrides default in O.View#positioning
   */
    positioning: 'absolute',

    /**
        Property: O.ScrollView#layout
        Type: Object
        Default:
                {
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                }

        Overrides default in O.View#layout
    */
    layout: NS.View.LAYOUT_FILL_PARENT,

    /**
        Property: O.ScrollView#keys
        Type: Object
        Default: {}

        Keyboard shortcuts to scroll the view. A map of keyboard shortcut to the
        method name to call on the O.ScrollView instance. These shortcuts will
        automatically be activated/deactivated when the view is added/removed
        to/from the document.

        For example, on the main scroll view for you content, you might set:

            {
                'pagedown': 'scrollPage',
                'pageup': 'reverseScrollPage',
                'space': 'scrollPage',
                'shift-space': 'reverseScrollPage',
                'down': 'scrollLine',
                'up': 'reverseScrollLine'
            }
    */
    keys: {},

    didAppendLayerToDocument: function () {
        // Scroll is reset to 0 some browsers whenever it is removed from the
        // DOM, so we need to set it to what it should be.
        var layer = this.get( 'layer' ),
            left = this.get( 'scrollLeft' ),
            top = this.get( 'scrollTop' );

        layer.scrollLeft = left;
        layer.scrollTop = top;
        layer.addEventListener( 'scroll', this, false );

        // Add keyboard shortcuts:
        var keys = this.get( 'keys' ),
            shortcuts = NS.ViewEventsController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.register( key, this, keys[ key ] );
        }

        return ScrollView.parent.didAppendLayerToDocument.call( this );
    },

    willRemoveLayerFromDocument: function () {
        // Remove keyboard shortcuts:
        var keys = this.get( 'keys' ),
            shortcuts = NS.ViewEventsController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.deregister( key, this, keys[ key ] );
        }

        this.get( 'layer' ).removeEventListener( 'scroll', this, false );

        return ScrollView.parent.willRemoveLayerFromDocument.call( this );
    },

    /**
        Property: O.ScrollView#scrollAnimation
        Type: O.Animation

        An <O.Animation> object to animate scrolling on this object. Normally
        you will not need to interact with this directly, but just set the
        `withAnimation` argument to `true` when you call O.ScrollView#scrollTo.
        However, if you wish to change the duration or easing method, you can do
        so by setting it on this object.
    */
    scrollAnimation: function ( ) {
        return new ScrollAnimation({
            object: this
        });
    }.property(),

    /**
        Method: O.ScrollView#scrollPage

        Scrolls the view down by the view height - 50px.
    */
    scrollPage: function () {
        return this.scrollBy( 0, this.get( 'pxHeight' ) - 50, true );
    },

    /**
        Method: O.ScrollView#reverseScrollPage

        Scrolls the view up by the view height - 50px.
    */
    reverseScrollPage: function () {
        return this.scrollBy( 0, 50 - this.get( 'pxHeight' ), true );
    },

    /**
        Method: O.ScrollView#scrollLine

        Scrolls the view down by 40px.
    */
    scrollLine: function () {
        return this.scrollBy( 0, 40 );
    },

    /**
        Method: O.ScrollView#reverseScrollLine

        Scrolls the view up by 40px.
    */
    reverseScrollLine: function () {
        return this.scrollBy( 0, -40 );
    },

    /**
        Method: O.ScrollView#scrollBy

        Scroll the view by the given number of pixels (use negative values to
        scroll up/left).

        Parameters:
            x             - {Number} The number of pixels to scroll right.
            y             - {Number} The number of pixels to scroll down.
            withAnimation - {Boolean} (optional) If true, animate the scroll.

        Returns:
            {Boolean} Did the view actually scroll (false if already at end)?
    */
    scrollBy: function ( x, y, withAnimation ) {
        var left = this.get( 'scrollLeft' ),
            top = this.get( 'scrollTop' );
        x += left;
        y += top;

        this.scrollTo( x, y, withAnimation );

        return top !== this.get( 'scrollTop' ) ||
            left !== this.get( 'scrollLeft' );
    },

    /**
        Method: O.ScrollView#scrollBy

        Scroll the view to a given position, where (0,0) represents the scroll
        view fully .

        Parameters:
            x             - {Number} The number of pixels to set the horizontal
                            scroll-position to.
            y             - {Number} The number of pixels to set the vertical
                            scroll-position to.
            withAnimation - {Boolean} (optional) If true, animate the scroll.

        Returns:
            {O.ScrollView} Returns self.
    */
    scrollTo: function ( x, y, withAnimation, _isAnimation ) {
        var scrollAnimation = this.get( 'scrollAnimation' );
        if ( withAnimation ) {
            scrollAnimation.animate({
                x: x,
                y: y
            });
            return this;
        } else if ( !_isAnimation ) {
            scrollAnimation.stop();
        }

        // Can't have negative scroll values.
        if ( x < 0 ) { x = 0; }
        if ( y < 0 ) { y = 0; }

        // Can only scroll when in the document; we'll scroll
        // on attachment anyway so just store the values otherwise.
        if ( this.get( 'isInDocument' ) ) {
            var layer = this.get( 'layer' );
            layer.scrollLeft = x;
            layer.scrollTop = y;
            // We don't know if they were greater than the max allowed value
            // (except if === 0).
            if ( x ) { x = layer.scrollLeft; }
            if ( y ) { y = layer.scrollTop; }
        }

        return this.beginPropertyChanges()
              .set( 'scrollLeft', x )
              .set( 'scrollTop', y )
            .endPropertyChanges();
    },

    /**
        Method: O.ScrollView#scrollToView

        Scroll the view to show a sub-view in the top left of the view.

        Parameters:
            view          - {View} The sub-view to scroll to.
            offset        - {Object} (optional) If supplied, must contain
                            numerical `x` and `y` properties which give the
                            number of pixels to offset the subview from the top
                            left of the scroll view.
            withAnimation - {Boolean} (optional) If true, animate the scroll.

        Returns:
            {O.ScrollView} Returns self.
    */
    scrollToView: function ( view, offset, withAnimation ) {
        var position = NS.Element.getPosition(
            view.get( 'layer' ), this.get( 'layer' ) );
        if ( !offset ) {
            offset = { x: 0, y: 0 };
        }
        return this.scrollTo(
            position.left + offset.x, position.top + offset.y, withAnimation );
    }
});

NS.ScrollView = ScrollView;

}( this.O ) );

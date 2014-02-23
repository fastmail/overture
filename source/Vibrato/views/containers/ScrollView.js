// -------------------------------------------------------------------------- \\
// File: ScrollView.js                                                        \\
// Module: ContainerViews                                                     \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
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
                this.startX + ( position * this.deltaX ) : this.endX,
            y = position < 1 ?
                this.startY + ( position * this.deltaY ) : this.endY;
        this.object._scrollTo( x, y );
    }
});

/**
    Class: O.ScrollView

    Extends: O.View

    An O.ScrollView instance is a fixed size container, which can be scrolled if
    its contents overflows the bounds of the view. By default, a scrollbar will
    only be shown for vertical overflow. Set the <O.ScrollView#showScrollbarX>
    property to `true` to show a scrollbar on horizontal overflow as well.
*/
var ScrollView = NS.Class({

    Extends: NS.View,

    /**
        Property: O.ScrollView#className
        Type: String
        Default: 'ScrollView'

        Overrides default in <O.View#className>.
    */
    className: 'ScrollView',


    /**
        Property: O.ScrollView#showScrollbarX
        Type: Boolean
        Default: false

        Show a scrollbar if the content horizontally overflows the bounds of the
        DOM element representing this view?
    */
    showScrollbarX: false,

    /**
        Property: O.ScrollView#showScrollbarY
        Type: Boolean
        Default: true

        Show a scrollbar if the content vertically overflows the bounds of the
        DOM element representing this view?
    */
    showScrollbarY: true,

    /**
        Property: O.ScrollView#positioning
        Type: String
        Default: 'absolute'

        Overrides default in <O.View#positioning>.
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

        Overrides default in <O.View#layout>.
    */
    layout: NS.View.LAYOUT_FILL_PARENT,

    /**
        Property: O.ScrollView#layerStyles
        Type: Object

        Sets the overflow styles to show the scrollbars.
    */
    layerStyles: function () {
        var styles = NS.View.prototype.layerStyles.call( this );
        styles.overflowX = this.get( 'showScrollbarX' ) ? 'auto' : 'hidden';
        styles.overflowY = this.get( 'showScrollbarY' ) ? 'auto' : 'hidden';
        return styles;
    }.property( 'layout', 'allowTextSelection', 'positioning',
        'showScrollbarX', 'showScrollbarY' ),

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

    didCreateLayer: function ( layer ) {
        this.scrollLayer = layer;
    },

    didEnterDocument: function () {
        this.get( 'scrollLayer' ).addEventListener( 'scroll', this, false );

        // Add keyboard shortcuts:
        var keys = this.get( 'keys' ),
            shortcuts = NS.ViewEventsController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.register( key, this, keys[ key ] );
        }

        return ScrollView.parent.didEnterDocument.call( this );
    },

    willLeaveDocument: function () {
        // Remove keyboard shortcuts:
        var keys = this.get( 'keys' ),
            shortcuts = NS.ViewEventsController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.deregister( key, this, keys[ key ] );
        }

        this.get( 'scrollLayer' ).removeEventListener( 'scroll', this, false );

        return ScrollView.parent.willLeaveDocument.call( this );
    },

    _restoreScroll: function () {
        // Scroll is reset to 0 in some browsers whenever it is removed from the
        // DOM, so we need to set it to what it should be.
        if ( this.get( 'isInDocument' ) ) {
            var layer = this.get( 'scrollLayer' );
            layer.scrollLeft = this.get( 'scrollLeft' );
            layer.scrollTop = this.get( 'scrollTop' );
        }
    }.queue( 'render' ).observes( 'isInDocument' ),

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
        var position = view.getPositionRelativeTo( this );
        return this.scrollTo(
            position.left + ( offset && offset.x || 0 ),
            position.top + ( offset && offset.y || 0 ),
            withAnimation
        );
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
    scrollTo: function ( x, y, withAnimation ) {
        // Can't have negative scroll values.
        if ( x < 0 ) { x = 0; }
        if ( y < 0 ) { y = 0; }

        var scrollAnimation = this.get( 'scrollAnimation' );
        scrollAnimation.stop();

        if ( withAnimation ) {
            scrollAnimation.animate({
                x: x,
                y: y
            });
        } else {
            this.beginPropertyChanges()
                .set( 'scrollLeft', x )
                .set( 'scrollTop', y )
            .endPropertyChanges()
            .propertyNeedsRedraw( this, 'scroll' );
        }
        return this;
    },

    /**
        Method (private): O.ScrollView#_scrollTo

        Set the new values and immediately redraw. Fast path for animation.
    */
    _scrollTo: function ( x, y ) {
        this.set( 'scrollLeft', x )
            .set( 'scrollTop', y );
        this.redrawScroll();
    },

    /**
        Method: O.ScrollView#redrawScroll

        Redraws the scroll position in the layer to match the view's state.
    */
    redrawScroll: function () {
        var layer = this.get( 'scrollLayer' ),
            x = this.get( 'scrollLeft' ),
            y = this.get( 'scrollTop' );
        layer.scrollLeft = x;
        layer.scrollTop = y;
        // In case we've gone past the end.
        if ( x || y ) {
            O.RunLoop.queueFn( 'after', this.syncBackScroll, this );
        }
    },

    /**
        Method: O.ScrollView#syncBackScroll

        Parameters:
            event - {Event} (optional) The scroll event object.

        Updates the view properties when the layer scrolls.
    */
    syncBackScroll: function ( event ) {
        if ( this._needsRedraw ) {
            O.RunLoop.queueFn( 'after', this.syncBackScroll, this );
            return;
        }
        var layer = this.get( 'scrollLayer' ),
            x = layer.scrollLeft,
            y = layer.scrollTop;
        this.beginPropertyChanges()
            .set( 'scrollLeft', x )
            .set( 'scrollTop', y )
            .endPropertyChanges();
        if ( event ) {
            event.stopPropagation();
            // Don't interpret tap to stop scroll as a real tap.
            if ( NS.Tap ) {
                NS.Tap.cancel();
            }
        }
    }.on( 'scroll' )
});

if ( NS.UA.isIOS ) {
    ScrollView.implement({
        draw: function ( layer, Element, el ) {
            var isFixedHeight = this.get( 'positioning' ) === 'absolute',
                contents, scrollFixerHeight, wrapper, children;

            // Preferred solution if height of div is fixed.
            if ( isFixedHeight ) {
                wrapper = this.scrollLayer = el( 'div', {
                    style: 'position:relative;height:100%;overflow:auto;' +
                        '-webkit-overflow-scrolling:touch;'
                });
                layer.appendChild( wrapper );
                scrollFixerHeight = '1';
            }
            // Fallback solution if we can't be sure.
            else {
                wrapper = layer;
                this.on( 'scroll', this, '_iosScroll' )
                    .addObserverForKey( 'isInDocument', this, '_iosScroll' );
                scrollFixerHeight = '2';
            }
            wrapper.appendChild(
                contents = el( 'div.ScrollViewContents', {
                    style: 'position:relative;' +
                        ( !isFixedHeight ? 'padding:1px 0;' : '' ) +
                        ( this.get( 'showScrollbarX' ) ?
                            '' : 'overflow:hidden;min-height:100%;' )
                })
            );
            wrapper.appendChild(
                el( 'div', {
                    style: 'position:absolute;top:100%;left: 0px;' +
                        'width:1px;height:' + scrollFixerHeight + 'px;'
                })
            );
            children = ScrollView.parent.draw.call( this, layer, Element, el );
            if ( children ) {
                Element.appendChildren( contents, children );
            }
        },
        _iosScroll: function () {
            if ( this.get( 'isInDocument' ) ) {
                var scrollTop = this.get( 'scrollTop' ),
                    scrollLeft = this.get( 'scrollLeft' );
                if ( !scrollTop ) {
                    this.scrollTo( scrollLeft, 1 );
                } else if ( scrollTop + this.get( 'pxHeight' ) ===
                        this.get( 'layer' ).scrollHeight ) {
                    this.scrollTo( scrollLeft, scrollTop - 1 );
                }
            }
        }.queue( 'after' ),
        insertView: function ( view, relativeTo, where ) {
            if ( !relativeTo && this.get( 'isRendered' ) &&
                    where !== 'before' && where !== 'after' ) {
                relativeTo = this.get( 'scrollLayer' ).firstChild;
            }
            return ScrollView.parent.insertView.call(
                this, view, relativeTo, where );
        }
    });
}

NS.ScrollView = ScrollView;

}( this.O ) );

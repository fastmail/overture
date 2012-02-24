// -------------------------------------------------------------------------- \\
// File: LightboxView.js                                                      \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, location*/

"use strict";

( function ( NS ) {

var LightboxPhotoView = NS.Class({
    
    Extends: NS.View,
    
    Mixin: NS.AnimatableView,
    
    hideControls: true,
    isActive: NS.bind( 'lightbox.isActive' ),
    curIndex: NS.bind( 'lightbox.index' ),
    
    frameThickness: 30,
    
    init: function ( lightbox, index, image ) {
        this.lightbox = lightbox;
        this.index = index;
        this._image = image;
        
        LightboxPhotoView.parent.init.call( this );
        
        this.redraw();
        
        if ( index === this.get( 'curIndex' ) ) {
            this.get( 'highResImage' );
        }
        
        lightbox.insertView( this );
    },
    
    className: function () {
        return 'LightboxPhotoView' +
            ( this.get( 'hideControls' ) ? ' hideControls' : '' );
    }.property( 'hideControls' ),
    
    thumbImage: function () {
        return NS.Element.create( 'img', {
            src: this._image.thumb.src,
            alt: ''
        });
    }.property(),
    
    _highResShowing: false,
    
    highResLoaded: false,
    
    highResImage: function () {
        var img = NS.Element.create( 'img', { alt: '' } );
        img.onload = function () {
            this.set( 'highResLoaded', true );
            img = img.onload = null;
        }.bind( this );
        img.src =
            this.get( 'lightbox' )
                .getSrcFor( this._image, this.get( 'centreLayout' ).width );
        return img;
    }.property(),
    
    switchToHighRes: function () {
        if ( !this.get( 'isDestroyed' ) && !this._isAnimating &&
                !Math.abs( this.get( 'index' ) - this.get( 'curIndex' ) ) ) {
            this.get( 'layer' ).replaceChild(
                this.get( 'highResImage' ), this.get( 'thumbImage' ) );
            this._highResShowing = true;
        }
    }.observes( 'highResLoaded' ),
    
    switchToLowRes: function () {
        this.get( 'layer' ).replaceChild(
            this.get( 'thumbImage' ), this.get( 'highResImage' ) );
        this._highResShowing = false;
    },
    
    _render: function ( layer ) {
        var Element = NS.Element,
            el = Element.create;
        
        Element.appendChildren( layer, [
            this.get( 'thumbImage' ),
            this._close = el( 'a.close', { href: location.href }, [
                el( 'span.navLink', [ NS.loc( 'Close' ) ] )
            ])
        ]);
    },
    
    manageImages: function ( obj ) {
        var position = Math.abs( this.get( 'index' ) - this.get( 'curIndex' ) ),
            currentIsHighRes = this._highResShowing,
            highResLoaded = this.get( 'highResLoaded' ),
            highResShowing = this._highResShowing;
        
        if ( !position ) {
            if ( highResLoaded ) {
                if ( !highResShowing ) {
                    this.switchToHighRes();
                }
            } else {
                this.get( 'highResImage' );
            }
        } else {
            // Remove at end of animation
            if ( highResShowing && !obj ) {
                this.switchToLowRes();
            }
        }
    }.observes( 'curIndex' ),
        
    redraw: function () {
        var position = this.get( 'index' ) - this.get( 'curIndex' ),
            layout =
                !position ?
                    this.get( 'isActive' ) ? 'centreLayout' : 'thumbLayout' :
                position > 0 ?
                    'rightLayout' : 'leftLayout';
        this.set( 'hideControls', !!position )
            .set( 'animateLayerDuration',
                position === 'thumbLayout' ? 300 : 500 )
            .set( 'layout', this.get( layout ) );
    }.observes( 'curIndex', 'isActive', 'dimensions' ),

    // --- Animation ---
    willAnimate: function () {
        this._isAnimating = true;
        this.get( 'lightbox' ).increment( 'animating', 1 );
    },
    didAnimate: function () {
        this._isAnimating = false;
        this.manageImages();
        this.get( 'lightbox' ).increment( 'animating', -1 );
    },

    // --- Layout ---
    
    dimensions: function () {
        var image = this._image,
            width = image.width,
            height = image.height,
            frame = this.get( 'frameThickness' ),
            
            lightbox = this.get( 'lightbox' ),
            lightboxWidth = lightbox.get( 'pxWidth' ),
            lightboxHeight = lightbox.get( 'pxHeight' ),
            
            // 75 is the minimum gap to the edge of the screen.
            maxWidth = Math.min( width, lightboxWidth - frame - 75 ),
            maxHeight = Math.min( height, lightboxHeight - frame - 75 ),
            
            ratio = Math.max( width / maxWidth, height / maxHeight );
        
        if ( ratio !== 1 ) {
            width = parseInt( width / ratio, 10 );
            height = parseInt( height / ratio, 10 );
        }
        
        return {
            canvasWidth: lightboxWidth,
            canvasHeight: lightboxHeight,
            
            width: Math.max( width, 150 ),
            height: Math.max( height, 100 )
        };
    }.property( 'lightbox.pxDimensions' ),
    
    thumbLayout: function () {
        var dimensions = this.get( 'dimensions' ),
            width = dimensions.width,
            height = dimensions.height,
            frame = this.get( 'frameThickness' ),
            thumb = this._image.thumb.getBoundingClientRect();
        
        return {
            width: width,
            height: height,
            // IE8 doesn't support bounds.(width|height)
            translateX: Math.floor( thumb.left +
                ( thumb.right - thumb.left - width - frame ) / 2 ),
            translateY: Math.floor( thumb.top +
                ( thumb.bottom - thumb.top - height - frame ) / 2 ),
            scale: ( thumb.right - thumb.left ) / ( width + frame )
        };
    }.property( 'dimensions' ),
    
    centreLayout: function () {
        var dimensions = this.get( 'dimensions' ),
            width = dimensions.width,
            height = dimensions.height,
            frame = this.get( 'frameThickness' );
        
        return {
            width: width,
            height: height,
            translateX: ( dimensions.canvasWidth - width - frame ) >> 1,
            translateY: ( dimensions.canvasHeight - height - frame ) >> 1
        };
    }.property( 'dimensions' ),
    
    leftLayout: function () {
        var dimensions = this.get( 'dimensions' ),
            width = dimensions.width,
            height = dimensions.height,
            frame = this.get( 'frameThickness' );
        
        return {
            width: dimensions.width,
            height: dimensions.height,
            translateX: -( width + frame ),
            translateY: ( dimensions.canvasHeight - height - frame ) >> 1,
            scale: 0.5
        };
    }.property( 'dimensions' ),
    
    rightLayout: function () {
        var dimensions = this.get( 'dimensions' ),
            width = dimensions.width,
            height = dimensions.height,
            frame = this.get( 'frameThickness' );
        
        return {
            width: width,
            height: height,
            translateX: dimensions.canvasWidth,
            translateY: ( dimensions.canvasHeight - height - frame ) >> 1,
            scale: 0.5
        };
    }.property( 'dimensions' ),
    
    // Event handling
    
    onClick: function ( event ) {
        var lightbox = this.get( 'lightbox' );
                
        if ( NS.Element.contains( this._close, event.target ) ) {
            lightbox.close();
        }
        
        event.preventDefault();
        event.stopPropagation();
    }.on( 'click' )
});

var LightboxView = NS.Class({

    Extends: NS.View,
    
    isActive: false,
    
    animating: 0,

    init: function ( app, options ) {
        LightboxView.parent.init.call( this, options );
        this._rootView = app.views.mainWindow;
        this._shortcuts = app.keyboardShortcuts;
    },
    
    index: function ( index ) {
        return index ? index.mod( this.get( 'total' ) ) : 0;
    }.property(),
    
    getSrcFor: function ( image, width ) {
        return image.src;
    },
    
    total: 0,

    className: function () {
        return 'LightboxView' +
            ( this.get( 'isActive' ) ? ' active' : '' );
    }.property( 'isActive' ),
    
    _render: function ( layer ) {
        var Element = NS.Element,
            el = Element.create,
            showNav = this.get( 'total' ) > 1;
            
        Element.appendChildren( layer, [
            el( 'div.background' ),
            showNav ? el( 'a.prev.navLink', { href: location.href }, [
                NS.loc( 'Previous' )
            ]) : null,
            showNav ? el( 'a.next.navLink', { href: location.href }, [
                NS.loc( 'Next' )
            ]) : null
        ]);
        LightboxView.parent._render.call( this, layer );
    },
    
    open: function ( images, startIndex ) {
        // Set index/total
        this.set( 'total', images.length )
            .set( 'index', startIndex );
                
        // Create views for contents. Those that need to, will automatically
        // insert themselves.
        this._views = images.map( function ( image, index ) {
            return new LightboxPhotoView( this, index, image );
        }, this );
        
        // Insert view
        this._rootView.insertView( this );
        
        // Capture events
        NS.RootViewController.queueResponder( this );

        // Now, fade in gradient background and views.
        this.set( 'isActive', true );
    },

    keyboardShortcuts: function ( event ) {
        switch ( NS.DOMEvent.lookupKey( event ) ) {
            case 'esc':
                this.close();
                break;
            case 'right':
                event.preventDefault();
                this.increment( 'index', 1 );
                break;
            case 'left':
                event.preventDefault();
                this.increment( 'index', -1 );
                break;
        }
    }.on( 'keydown' ),
    
    onClick: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) { return; }
        var action = event.target.className;
        if ( /prev/.test( action ) ) {
            this.increment( 'index', -1 );
        } else if ( /next/.test( action ) ) {
            this.increment( 'index', 1 );
        } else {
            this.close();
        }
        event.stopPropagation();
    }.on( 'click' ),

    close: function () {
        // Stop capturing events
        NS.RootViewController.removeResponder( this );
        
        // Fade out gradient background and views.
        this.set( 'isActive', false );
    },
    
    removeFromDocument: function () {
        if ( !this.get( 'animating' ) &&
                !this.get( 'isActive' ) &&
                this.get( 'isInDocument' ) ) {
            
            this._rootView.removeView( this );
            
            var children = this._views,
                l = children.length,
                child;
            while ( l-- ) {
                child = children[l];
                this.removeView( child );
                child.destroy();
            }
        }
    }.observes( 'animating' ),
    
    pxWidth: function () {
        return this._rootView.get( 'pxWidth' );
    }.property().nocache(),
    
    pxHeight: function () {
        return this._rootView.get( 'pxHeight' );
    }.property().nocache()
});

NS.LightboxView = LightboxView;

}( O ) );
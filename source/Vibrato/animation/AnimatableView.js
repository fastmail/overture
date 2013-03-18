// -------------------------------------------------------------------------- \\
// File: AnimatableView.js                                                    \\
// Module: Animation                                                          \\
// Requires: Core, UA, Animation.js                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

NS.AnimatableView = {

    animateLayer: true,
    animateLayerDuration: 300,
    animateLayerEasing: NS.Easing.ease,

    animating: 0,
    willAnimate: function () {
        this.increment( 'animating', 1 );
    },
    didAnimate: function () {
        this.increment( 'animating', -1 );
    },

    layerAnimation: function () {
        var Animation = NS.UA.cssProps.transition ?
            NS.CSSStyleAnimation : NS.StyleAnimation;
        return new Animation({
            object: this,
            element: this.get( 'layer' )
        });
    }.property(),

    redrawLayerStyles: function ( layer, oldStyles ) {
        var newStyles = this.get( 'layerStyles' ),
            layerAnimation = this.get( 'layerAnimation' ),
            setStyle = NS.Element.setStyle,
            property, value;

        // Animate
        if ( this.get( 'animateLayer' ) && this.get( 'isInDocument' ) ) {
            if ( !layerAnimation.current ) {
                layerAnimation.current = oldStyles || newStyles;
            }
            layerAnimation.animate(
                newStyles,
                this.get( 'animateLayerDuration' ),
                this.get( 'animateLayerEasing' )
            );
        }
        // Or just set.
        else {
            layerAnimation.stop();
            layerAnimation.current = newStyles;
            setStyle( layer, 'transition-property', 'none' );
            for ( property in newStyles ) {
                value = newStyles[ property ];
                if ( value !== oldStyles[ property ] ) {
                    setStyle( layer, property, value );
                }
            }
        }
    }
};

}( this.O ) );

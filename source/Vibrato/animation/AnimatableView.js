// -------------------------------------------------------------------------- \\
// File: AnimatableView.js                                                    \\
// Module: Animation                                                          \\
// Requires: Core, UA, Animation.js                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Mixin: O.AnimatableView

    Mix this into an <O.View> class to automatically animate all changes to the
    view's <O.View#layerStyles> property.
*/
NS.AnimatableView = {

    /**
        Property: O.AnimatableView#animateLayer
        Type: Boolean
        Default: true

        If true, changes to the view's <O.View#layerStyles> property will be
        animated. If false, the changes will be set without animation.
    */
    animateLayer: true,

    /**
        Property: O.AnimatableView#animateLayerDuration
        Type: Number
        Default: 300

        The length of time in milliseconds to animate changes to the view's
        layer styles.
    */
    animateLayerDuration: 300,

    /**
        Property: O.AnimatableView#animateLayerEasing
        Type: Function
        Default: O.Easing.ease

        The easing function to use for the animation of the view's layer styles.
    */
    animateLayerEasing: NS.Easing.ease,

    /**
        Property: O.AnimatableView#animating
        Type: Number

        The number of properties on the view currently being animated. Note,
        <O.View#layerStyles> counts as a single property.
    */
    animating: 0,

    /**
        Method: O.AnimatableView#willAnimate

        This method is called by the <O.Animation> class when it begins
        animating a property on the object. Increments the <#animating>
        property.
    */
    willAnimate: function () {
        this.increment( 'animating', 1 );
    },

    /**
        Method: O.AnimatableView#didAnimate

        This method is called by the <O.Animation> class when it finshes
        animating a property on the object. Decrements the <#animating>
        property.
    */
    didAnimate: function () {
        this.increment( 'animating', -1 );
    },

    /**
        Property: O.AnimatableView#layerAnimation
        Type: O.CSSStyleAnimation|O.StyleAnimation

        An appropriate animation object (depending on browser support) to
        animate the layer styles. Automatically generated when first accessed.
    */
    layerAnimation: function () {
        var Animation = NS.UA.cssProps.transition ?
            NS.CSSStyleAnimation : NS.StyleAnimation;
        return new Animation({
            object: this,
            element: this.get( 'layer' )
        });
    }.property(),

    /**
        Method: O.AnimatableView#redrawLayerStyles

        Overrides <O.View#redrawLayerStyles> to animate the change in styles
        instead of setting them immediately.

        Parameters:
            layer     - {Element} The view's layer.
            oldStyles - {Object|null} The previous layer styles for the view.
    */
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

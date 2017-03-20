import UA from '../ua/UA.js';
import RunLoop from '../foundation/RunLoop.js';
import '../foundation/ComputedProps.js';  // For Function#property
import Element from '../dom/Element.js';
import Easing from './Easing.js';
import CSSStyleAnimation from './CSSStyleAnimation.js';
import StyleAnimation from './StyleAnimation.js';

/**
    Mixin: O.AnimatableView

    Mix this into an <O.View> class to automatically animate all changes to the
    view's <O.View#layerStyles> property.
*/
export default {

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
    animateLayerEasing: Easing.ease,

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
        const Animation = UA.cssProps.transition ?
            CSSStyleAnimation : StyleAnimation;
        return new Animation({
            object: this,
            element: this.get( 'layer' ),
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
        const newStyles = this.get( 'layerStyles' );
        const layerAnimation = this.get( 'layerAnimation' );
        const setStyle = Element.setStyle;

        // Animate
        if ( this.get( 'animateLayer' ) ) {
            // Must wait until in document to animate
            if ( !this.get( 'isInDocument' ) ) {
                RunLoop.invokeInNextFrame(
                    this.propertyNeedsRedraw.bind(
                        this, this, 'layerStyles', oldStyles ) );
                return;
            }
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
            for ( const property in newStyles ) {
                const value = newStyles[ property ];
                if ( value !== oldStyles[ property ] ) {
                    setStyle( layer, property, value );
                }
            }
        }
        // Just remove styles that are not specified in the new styles, but were
        // in the old styles
        for ( const property in oldStyles ) {
            if ( !( property in newStyles ) ) {
                setStyle( layer, property, null );
            }
        }
    },
};

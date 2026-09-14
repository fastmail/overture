import { ease } from './Easing.js';
import { StyleAnimation } from './StyleAnimation.js';

/* { property } from */
import '../foundation/Decorators.js';

/**
    Mixin: O.AnimatableView

    Mix this into an <O.View> class to automatically animate all changes to the
    view's <O.View#layerStyles> property.

    The animation is run by the browser (see <O.StyleAnimation>), so changes
    to `transform` and `opacity`, and to `top` in px, run on the compositor
    thread and stay smooth even when the main thread is busy. Other layout
    properties are still animated, but need layout on every frame; prefer
    expressing a change as a transform where you can.
*/
const AnimatableView = {
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
        Cubic beziers from <O.Easing> are passed to the browser exactly; other
        functions are approximated with a CSS `linear()` timing function, or
        the closest cubic bezier where the browser lacks `linear()`.
    */
    animateLayerEasing: ease,

    /**
        Property: O.AnimatableView#animating
        Type: Number

        The number of properties on the view currently being animated. Note,
        <O.View#layerStyles> counts as a single property.
    */
    animating: 0,

    /**
        Method: O.AnimatableView#willAnimate

        This method is called by the <O.Animation> and <O.StyleAnimation>
        classes when they begin animating a property on the object. Increments
        the <#animating> property.
    */
    willAnimate() {
        this.increment('animating', 1);
    },

    /**
        Method: O.AnimatableView#didAnimate

        This method is called by the <O.Animation> and <O.StyleAnimation>
        classes when they finish animating a property on the object. Decrements
        the <#animating> property.
    */
    didAnimate(animation) {
        this.increment('animating', -1);
        if (
            !this.get('animating') &&
            animation instanceof StyleAnimation &&
            animation.animated.some(
                (property) =>
                    property !== 'opacity' && property !== 'transform',
            )
        ) {
            this.parentViewDidResize();
        }
    },

    /**
        Property: O.AnimatableView#layerAnimation
        Type: O.StyleAnimation

        The animation object for the layer styles. Automatically generated
        when first accessed.
    */
    layerAnimation: function () {
        return new StyleAnimation({
            object: this,
            element: this.get('layer'),
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
    redrawLayerStyles(layer, oldStyles) {
        const newStyles = this.get('layerStyles');
        const layerAnimation = this.get('layerAnimation');

        if (!layerAnimation.current) {
            layerAnimation.current = oldStyles || newStyles;
        }

        if (this.get('animateLayer') && this.get('isInDocument')) {
            layerAnimation.animate(
                newStyles,
                this.get('animateLayerDuration'),
                this.get('animateLayerEasing'),
            );
            // Nothing needed animating; still tell observers of `animating`
            // that the change has been drawn.
            if (!layerAnimation.isRunning) {
                this.willAnimate(layerAnimation);
                this.didAnimate(layerAnimation);
            }
        } else {
            layerAnimation.set(newStyles);
            this.parentViewDidResize();
        }
    },

    /**
        Method: O.AnimatableView#resetAnimation

        Stops any running layer animation, jumping the view straight to the
        layout it was animating towards. Use this before setting a new layout
        when the view must not continue from part way through the old
        animation.
     */
    resetAnimation() {
        this.get('layerAnimation').stop();
    },
};

export { AnimatableView };

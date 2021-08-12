import { Class } from '../../core/Core.js';
import /* { observes } from */ '../../foundation/Decorators.js';
import { View } from '../View.js';

/**
    Class: O.TextView

    Extends: O.View

    A TextView simply displays a string of text, and optionally has a tooltip.
    Its DOM structure is:

        <span title="${view.tooltip}">${view.value}</span>

    Although you may often want to change the layer tag (e.g. to an `h1` etc.)
*/
const TextView = Class({
    Name: 'TextView',

    Extends: View,

    /**
        Property: O.TextView#layerTag
        Type: String
        Default: 'span'

        Overrides default in <O.View#layerTag>.
    */
    layerTag: 'span',

    /**
        Property: O.TextView.value
        Type: String
        Default: ''

        The text to display in the view.
    */
    value: '',

    /**
        Property: O.TextView#tooltip
        Type: String
        Default: ''

        The tooltip for the view.
    */
    tooltip: '',

    /**
        Method: O.TextView#draw

        Overridden to draw view. See <O.View#draw>.
    */
    draw(layer) {
        const tooltip = this.get('tooltip');
        if (tooltip) {
            layer.title = tooltip;
        }
        layer.textContent = this.get('value');
    },

    /**
        Method: O.TextView#labelNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    labelNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('tooltip', 'value'),

    /**
        Method: O.TextView#redrawTooltip

        Parameters:
            layer - {Element} The DOM layer for the view.

        Updates the title attribute on the DOM layer to match the tooltip
        property of the view.
    */
    redrawTooltip(layer) {
        const tooltip = this.get('tooltip');
        if (tooltip) {
            layer.title = tooltip;
        } else {
            layer.removeAttribute('title');
        }
    },

    /**
        Method: O.TextView#redrawValue

        Parameters:
            layer - {Element} The DOM layer for the view.

        Updates the text content of the DOM layer to match the value property of
        the view.
    */
    redrawValue(layer) {
        layer.textContent = this.get('value');
    },
});

export { TextView };

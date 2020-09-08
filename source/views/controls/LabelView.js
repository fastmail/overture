import { Class } from '../../core/Core.js';
import '../../foundation/ObservableProps.js'; // For Function#observes
import View from '../View.js';

/**
    Class: O.LabelView

    Extends: O.View

    A LabelView simply displays a string of text, and optionally has a tooltip.
    Its DOM structure is:

        <span title="${view.tooltip}">${view.value}</span>

    Although you may often want to change the layer tag (e.g. to an `h1` etc.)
*/
const LabelView = Class({
    Extends: View,

    /**
        Property: O.LabelView#layerTag
        Type: String
        Default: 'span'

        Overrides default in <O.View#layerTag>.
    */
    layerTag: 'span',

    /**
        Property: O.LabelView.value
        Type: String
        Default: ''

        The text to display in the view.
    */
    value: '',

    /**
        Property: O.LabelView#tooltip
        Type: String
        Default: ''

        The tooltip for the view.
    */
    tooltip: '',

    /**
        Method: O.LabelView#draw

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
        Method: O.LabelView#labelNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    labelNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('tooltip', 'value'),

    /**
        Method: O.LabelView#redrawTooltip

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
        Method: O.LabelView#redrawValue

        Parameters:
            layer - {Element} The DOM layer for the view.

        Updates the text content of the DOM layer to match the value property of
        the view.
    */
    redrawValue(layer) {
        layer.textContent = this.get('value');
    },
});

export default LabelView;

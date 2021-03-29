import { Class, isEqual } from '../../core/Core.js';
import /* { property, on, observes } from */ '../../foundation/Decorators.js';
import { create as el } from '../../dom/Element.js';
import { AbstractControlView } from './AbstractControlView.js';

/**
    Class: O.SelectView

    Extends: O.AbstractControlView

    A view representing an HTML `<select>` menu. The `value` property is two-way
    bindable, representing the selected option.
*/
const SelectView = Class({
    Name: 'SelectView',

    Extends: AbstractControlView,

    /**
        Property: O.SelectView#options
        Type: Array

        The array of options to present in the select menu. Each item in the
        array should be an object, with the following properties:

        text       - {String} The text to display for the item
        value      - {*} The value for the <O.SelectView#value> property to take
                     when this item is selected.
        isDisabled - {Boolean} (optional) If true, the option will be disabled
                     (unselectable). Defaults to false if not present.
    */
    options: [],

    /**
        Property: O.SelectView#inputAttributes
        Type: Object|null

        Extra attributes to add to the <select> element, if provided.
    */
    inputAttributes: null,

    // --- Render ---

    type: '',

    /**
        Property: O.SelectView#className
        Type: String
        Default: 'v-Select'

        Overrides default in <O.View#className>.
    */
    className: function () {
        const type = this.get('type');
        return (
            'v-Select' +
            (this.get('isFocused') ? ' is-focused' : '') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (type ? ' ' + type : '')
        );
    }.property('type', 'isFocused', 'isDisabled'),

    /**
        Method: O.SelectView#draw

        Overridden to draw select menu in layer. See <O.View#draw>.
    */
    draw(layer) {
        const control = (this._domControl = this._drawSelect(
            this.get('options'),
        ));
        const inputAttributes = this.get('inputAttributes');
        if (inputAttributes) {
            this.redrawInputAttributes();
        }
        return [SelectView.parent.draw.call(this, layer), control];
    },

    /**
        Method (private): O.SelectView#_drawSelect

        Creates the DOM elements for the `<select>` and all `<option>` children.

        Parameters:
            options - {Array} Array of option objects.

        Returns:
            {Element} The `<select>`.
    */
    _drawSelect(options) {
        const selected = this.get('value');
        const select = el(
            'select',
            {
                className: 'v-Select-input',
                disabled: this.get('isDisabled'),
            },
            options.map((option, i) =>
                el('option', {
                    text: option.text,
                    value: i,
                    selected: isEqual(option.value, selected),
                    disabled: !!option.isDisabled,
                }),
            ),
        );
        return select;
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.SelectView#selectNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    selectNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('options', 'value', 'inputAttributes'),

    /**
        Method: O.SelectView#redrawInputAttributes

        Updates any other properties of the `<input>` element.
    */
    redrawInputAttributes() {
        const inputAttributes = this.get('inputAttributes');
        const control = this._domControl;
        for (const property in inputAttributes) {
            control.set(property, inputAttributes[property]);
        }
    },

    /**
        Method: O.SelectView#redrawOptions

        Updates the DOM representation when the <O.SelectView#options> property
        changes.
    */
    redrawOptions(layer, oldOptions) {
        const options = this.get('options');
        if (!isEqual(options, oldOptions)) {
            // Must blur before removing from DOM in iOS, otherwise
            // the slot-machine selector will not hide
            const isFocused = this.get('isFocused');
            const select = this._drawSelect(options);
            if (isFocused) {
                this.blur();
            }
            layer.replaceChild(select, this._domControl);
            this._domControl = select;
            if (isFocused) {
                this.focus();
            }
        }
    },

    /**
        Method: O.SelectView#redrawValue

        Selects the corresponding option in the select when the
        <O.SelectView#value> property changes.
    */
    redrawValue() {
        const value = this.get('value');
        const options = this.get('options');
        let l = options.length;

        while (l--) {
            if (isEqual(options[l].value, value)) {
                this._domControl.value = l + '';
                return;
            }
        }
        // Work around Chrome on Android bug where it doesn't redraw the
        // select control until the element blurs.
        if (this.get('isFocused')) {
            this.blur().focus();
        }
    },

    // --- Keep state in sync with render ---

    /**
        Method: O.SelectView#syncBackValue

        Observes the `change` event to update the view's `value` property when
        the user selects a different option.
    */
    syncBackValue: function () {
        const i = this._domControl.selectedIndex;
        const option = this.get('options').getObjectAt(i);
        if (option) {
            this.userDidInput(option.value);
        }
    }.on('change'),
});

export { SelectView };

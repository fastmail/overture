import { Class, isEqual } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { AbstractInputView } from './AbstractInputView.js';

// ---

const HANDLED_KEYS = new Set([
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
]);

/**
    Class: O.RadioGroupView

    Extends: O.AbstractInputView

    A view representing an HTML `<select>` menu. The `value` property is two-way
    bindable, representing the selected option.
*/
const RadioGroupView = Class({
    Name: 'RadioGroupView',

    Extends: AbstractInputView,

    init: function (/* ...mixins */) {
        RadioGroupView.parent.constructor.apply(this, arguments);
        this._domControls = [];
    },

    selectedIndex: function () {
        const value = this.get('value');
        return this.get('options').findIndex((option) => {
            return isEqual(value, option.value);
        });
    }.property('value'),

    value: null,

    /**
        Property: O.RadioGroupView#options
        Type: Array

        The array of options to present in the select menu. Each item in the
        array should be an object, with the following properties:

        label       - {String} The text to display for the item
        description - {String} The subtext to display for the item
        value       - {*} The value for the <O.RadioGroupView#value> property to take
                      when this item is selected.
        isDisabled  - {Boolean} (optional) If true, the option will be disabled
                      (unselectable). Defaults to false if not present.
    */
    options: [],

    // --- Render ---

    layerTag: 'fieldset',

    baseClassName: 'v-RadioGroup',

    /**
        Method: O.RadioGroupView#drawControl
        Parameters:
            option - {Object} The object that represents the radio option. The 
                      properties of this object are defined in 
                      O.RadioGroupView#options.
            index  - {Number} Index of the option in the group

        Returns radio button for provided option. Accessed in
        <O.RadioGroupView#drawOption>.
    */
    drawControl(option, index) {
        const id = this.get('id');
        const control = el('input', {
            type: 'radio',
            id: id + '-option-' + index,
            className: this.get('baseClassName') + '-input',
            checked: isEqual(this.get('value'), option.value),
            disabled: this.get('isDisabled') || option.isDisabled,
            name: this.get('name') || id + '-value',
            tabIndex: '-1',
            onchange: (event) => {
                if (event.target.checked) {
                    this.userDidInput(option.value);
                }
            },
        });
        this._domControls.push(control);
        if (!index || control.checked) {
            this._domControl = control;
        }
        return control;
    },

    drawLabel(label, option) {
        return el(option ? 'p' : 'legend', [label]);
    },

    /**
        Method: O.RadioGroupView#drawOption
        Parameters:
            option - {Object} The object that represents the radio option
                value - {*} Value to be returned if option is selected
                label - {String} Label for the option
                description = {String} Descriptive text for option
                isDisabled - {Boolean} Is the option disabled?
            index - {Number} Index of the option in the group

        Returns an individual labelled radio option, with DOM control from
        <O.RadioGroupView#drawControl>
    */
    drawOption(option, index) {
        const baseClassName = this.get('baseClassName');

        const control = this.drawControl(option, index);

        const label = this.drawLabel(option.label, option);

        let description = option.description;
        if (description) {
            description = this.drawDescription(description, option);
        }

        return el(`label.${baseClassName}-option`, [
            control,
            el(`div.${baseClassName}-text`, [label, description]),
        ]);
    },

    /**
        Method: O.RadioGroupView#draw

        Overridden to draw select menu in layer. See <O.View#draw>.
    */
    draw(/*layer*/) {
        let label = this.get('label');
        if (label) {
            label = this.drawLabel(label);
        }

        let description = this.get('description');
        if (description) {
            description = this.drawDescription(description);
        }

        const options = el(`div.${this.get('baseClassName')}-options`, [
            this.get('options').map(this.drawOption, this),
        ]);

        this.redrawTabIndex();

        return [label, description, options];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.RadioGroupView#optionsNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    optionsNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('options'),

    /**
        Method: O.RadioGroupView#redrawOptions

        Updates the DOM representation when the <O.RadioGroupView#options> property
        changes.
    */
    redrawOptions(layer, oldOptions) {
        const options = this.get('options');
        if (!isEqual(options, oldOptions)) {
            this._domControls = [];
            layer.replaceChild(
                el(`div.${this.get('baseClassName')}-options`, [
                    options.map(this.drawOption, this),
                ]),
                layer.lastChild,
            );

            this.redrawTabIndex();

            if (this.get('isFocused')) {
                this.focus();
            }
        }
    },

    redrawIsDisabled() {
        const isDisabled = this.get('isDisabled');
        const options = this.get('options');
        this._domControls.forEach((control, i) => {
            control.disabled = isDisabled || options[i].isDisabled;
        });
    },

    redrawName() {
        const name = this.get('name');
        this._domControls.forEach((control) => {
            control.name = name;
        });
    },

    redrawValue() {
        let index = this.get('selectedIndex');

        let isChecked;
        if (index < 0) {
            index = 0;
            isChecked = false;
        } else {
            isChecked = true;
        }

        const control = this._domControls[index];
        const oldControl = this._domControl;
        oldControl.checked = false;
        oldControl.tabIndex = '-1';

        control.checked = isChecked;
        control.tabIndex = this.get('tabIndex');
        if (this.get('isFocused')) {
            control.focus();
        }
        this._domControl = control;
    },

    /**
        Method (private): O.RadioGroupView#_updateIsFocused

        Updates the <#isFocused> property.

        Parameters:
            event - {Event} The focus event.
    */
    _updateIsFocused: function (event) {
        if (event.type === 'focus') {
            this.set('isFocused', true);
        } else if (!this.get('layer').contains(event.relatedTarget)) {
            this.set('isFocused', false);
        }
    }.on('focus', 'blur'),

    keydown: function (event) {
        const key = event.key;
        if (!HANDLED_KEYS.has(key)) {
            return;
        }
        event.preventDefault();

        let index = this.get('selectedIndex');
        if (key === 'ArrowDown' || key === 'ArrowRight') {
            index += 1;
        } else {
            index -= 1;
        }

        const options = this.get('options');
        const maxIndex = options.length - 1;
        if (index > maxIndex) {
            index = 0;
        } else if (index < 0) {
            index = maxIndex;
        }

        this.userDidInput(options[index].value);
    }.on('keydown'),
});

export { RadioGroupView };

import { Class, isEqual } from '../../core/Core.js';
import { appendChildren, create as el } from '../../dom/Element.js';
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
        const options = this.get('options');
        const value = this.get('value');
        this.selectedIndex = options.findIndex((option) => {
            return isEqual(value, option.value);
        });
    },

    selectedIndex: null,

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

    type: '',

    drawControl(option, index) {
        const id = this.get('id');
        const control = el('input', {
            type: 'radio',
            id: id + '-option-' + index,
            className: this.get('baseClassName') + '-input',
            checked: index === this.get('selectedIndex'),
            disabled: this.get('isDisabled') || option.isDisabled,
            name: this.get('name') || id + '-value',
            tabIndex: '-1',
            onchange: (event) => {
                if (event.target.checked) {
                    this._settingFromInput = true;
                    this.set('selectedIndex', index);
                    this._settingFromInput = false;
                }
            },
        });
        this._domControls.push(control);
        if (control.checked) {
            this._domControl = control;
        }
        return control;
    },

    drawLabel(label) {
        return el('p', [label]);
    },

    /**
        Method: O.ToggleView#draw

        Overridden to draw toggle in layer. See <O.View#draw>.
    */
    drawOption(option, index) {
        const baseClassName = this.get('baseClassName');

        const control = this.drawControl(option, index);

        const label = this.drawLabel(option.label, option);

        let description = option.description;
        if (description) {
            description = this.drawDescription(description, option);
        }

        return el(
            `label.${baseClassName}-option`,
            [control, el(`div.${baseClassName}-text`, [label, description])],
        );
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

        const options = this.get('options').map(this.drawOption, this);

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
            const baseElements = this.get('description') ? 2 : 1;
            while (layer.childElementCount > baseElements) {
                layer.removeChild(layer.lastElementChild);
            }

            const value = this.get('value');
            this.selectedIndex = options.findIndex((option) => {
                return isEqual(value, option.value);
            });

            this._domControls = [];
            appendChildren(layer, options.map(this.drawOption, this));

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

    selectedIndexDidChange: function (_, __, oldIndex, index) {
        const control = this._domControls[index];
        if (control) {
            control.checked = true;
            control.tabIndex = this.get('tabIndex');
            if (this.get('isFocused')) {
                control.focus();
            }
            this._domControl = control;
        } else {
            this._domControl = this._domControls[0];
        }

        const oldControl = this._domControls[oldIndex];
        if (oldControl) {
            oldControl.checked = false;
            if (index !== -1) {
                oldControl.tabIndex = '-1';
            }
        }

        const newValue = index > -1 ? this.get('options')[index].value : null;
        if (this._settingFromInput) {
            this.userDidInput(newValue);
        }
    }.observes('selectedIndex'),

    /**
        Method (private): O.AbstractControlView#_updateIsFocused

        Updates the <#isFocused> property.

        Parameters:
            event - {Event} The focus event.
    */
    _updateIsFocused: function (event) {
        if (event.type === 'focusin') {
            this.set('isFocused', true);
        } else if (!this.get('layer').contains(event.relatedTarget)) {
            this.set('isFocused', false);
        }
    }.on('focusin', 'focusout'),

    /**
        Method: O.RadioGroupView#redrawValue

        Checks the corresponding control in the radio group when the
        <O.RadioGroupView#value> property changes.
    */
    valueDidChange: function (_, __, ___, value) {
        if (this._settingFromInput) {
            return;
        }
        const options = this.get('options');
        this.set(
            'selectedIndex',
            options.findIndex((option) => isEqual(value, option.value)),
        );
    }.observes('value'),

    keydown: function (event) {
        const key = event.key;
        if (!HANDLED_KEYS.has(key)) {
            return;
        }
        event.preventDefault();

        let selectedIndex = this.get('selectedIndex');
        if (key === 'ArrowDown' || key === 'ArrowRight') {
            selectedIndex += 1;
        } else {
            selectedIndex -= 1;
        }

        const maxIndex = this.get('options').length - 1;
        if (selectedIndex > maxIndex) {
            selectedIndex = 0;
        } else if (selectedIndex < 0) {
            selectedIndex = maxIndex;
        }
        this._settingFromInput = true;
        this.set('selectedIndex', selectedIndex);
        this._settingFromInput = false;
    }.on('keydown'),
});

export { RadioGroupView };

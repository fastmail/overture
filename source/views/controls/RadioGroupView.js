import { Class, isEqual } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { AbstractControlView } from './AbstractControlView.js';

// ---

const HANDLED_KEYS = new Set([
    ' ',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
]);

/**
    Class: O.RadioGroupView

    Extends: O.AbstractControlView

    A view representing an HTML `<select>` menu. The `value` property is two-way
    bindable, representing the selected option.
*/
const RadioGroupView = Class({
    Name: 'RadioGroupView',

    Extends: AbstractControlView,

    icon: null,

    label: '',

    description: '',

    tabIndex: 0,

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

    _domControls: [],
    selectedIndex: -1,

    layerTag: 'fieldset',

    type: '',

    /**
        Property: O.RadioGroupView#className
        Type: String
        Default: 'v-Select'

        Overrides default in <O.View#className>.
    */
    className: function () {
        const type = this.get('type');
        return (
            'v-RadioGroup' +
            (this.get('blocks') ? ' v-RadioGroup-blocks' : '') +
            (this.get('isFocused') ? ' is-focused' : '') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (type ? ' ' + type : '')
        );
    }.property('type', 'isFocused', 'isDisabled', 'blocks'),

    /**
        Method: O.ToggleView#draw

        Overridden to draw toggle in layer. See <O.View#draw>.
    */
    drawOption(option, index) {
        const id = this.get('id');
        const icon = this.get('icon');
        const value = this.get('value');
        const isDisabled = this.get('isDisabled');
        const isSelected = isEqual(value, option.value);
        if (isSelected) {
            this.selectedIndex = index;
        }

        const radio = el('input', {
            type: 'radio',
            id: id + '-option-' + index,
            checked: isSelected,
            disabled: isDisabled || option.isDisabled,
            hidden: !!icon,
            onchange: (event) => {
                if (event.target.checked) {
                    this.set('selectedIndex', index);
                }
            },
        });

        let name = this.get('name');
        if (!name) {
            name = id + '-value';
        }
        radio.name = name;

        const label = el('p.u-trim', [option.label]);

        let description = option.description;
        if (description) {
            label.classList.add('u-trim-top');
            description = el('p.u-description.u-trim-bottom', [description]);
        }

        const control = el(
            'label.v-RadioGroup-option.v-RadioGroup-content',
            {
                for: radio.id,
            },
            [
                icon ? el('i.v-RadioGroup-icon', [icon.cloneNode(true)]) : null,
                el('div.v-RadioGroup-text', [label, description]),
            ],
        );
        this._domControls.push(control);

        if (isSelected || (index === 0 && !value)) {
            this._domControl = control;
            control.setAttribute('tabindex', this.get('tabIndex'));
        }

        return [radio, control];
    },

    /**
        Method: O.RadioGroupView#draw

        Overridden to draw select menu in layer. See <O.View#draw>.
    */
    draw(/*layer*/) {
        this._domControls = [];

        const label = (this._domLabel = el('legend.u-label.u-trim', [
            this.get('label'),
        ]));

        let description = this.get('description');
        if (description) {
            label.classList.add('u-trim-top');
            description = this._domDescription = el(
                'p.u-description.u-trim.u-trim-bottom',
                [description],
            );
        }

        return [
            label,
            description,
            this.get('options').map(this.drawOption, this),
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.RadioGroupView#radioGroupNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    radioGroupNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('options', 'value'),

    /**
        Method: O.RadioGroupView#redrawOptions

        Updates the DOM representation when the <O.RadioGroupView#options> property
        changes.
    */
    redrawOptions(layer, oldOptions) {
        const options = this.get('options');
        if (!isEqual(options, oldOptions)) {
            // Must blur before removing from DOM in iOS, otherwise
            // the slot-machine selector will not hide
            const isFocused = this.get('isFocused');
            if (isFocused) {
                this.blur();
            }

            const baseElements = this.get('description') ? 2 : 1;
            while (layer.childElementCount > baseElements) {
                layer.removeChild(layer.lastElementChild);
            }

            this._domControls = [];
            options.forEach((option, i) => {
                const [radio, control] = this.drawOption(option, i);
                layer.appendChild(radio);
                layer.appendChild(control);
            });

            if (isFocused) {
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

    redrawTabIndex() {
        let index = this.get('selectedIndex');
        if (index < 0) {
            index = 0;
        }
        this._domControls[index].tabIndex = this.get('tabIndex');
    },

    /**
        Method: O.RadioGroupView#redrawValue

        Checks the corresponding control in the radio group when the
        <O.RadioGroupView#value> property changes.
    */
    redrawValue() {
        const value = this.get('value');
        const options = this.get('options');

        this.set(
            'selectedIndex',
            options.findIndex((option) => isEqual(value, option.value)),
        );
    },

    selectedIndexDidChange: function (_, __, oldIndex, index) {
        const control = this._domControls[index];
        if (control) {
            control.previousElementSibling.checked = true;
            control.setAttribute('tabindex', this.get('tabIndex'));
            if (this.get('isFocused')) {
                control.focus();
            }
            this._domControl = control;
        } else {
            this._domControl = this._domControls[0];
        }

        const oldControl = this._domControls[oldIndex];
        if (oldControl) {
            oldControl.previousElementSibling.checked = false;
            if (index !== -1) {
                oldControl.removeAttribute('tabindex');
            }
        }

        const newValue = index > -1 ? this.get('options')[index].value : null;
        this.userDidInput(newValue);
    }.observes('selectedIndex'),

    keydown: function (event) {
        const key = event.key;
        if (!HANDLED_KEYS.has(key)) {
            return;
        }
        event.preventDefault();

        if (key === ' ') {
            event.target.click();
            return;
        }

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
        this.set('selectedIndex', selectedIndex);
    }.on('keydown'),

    _updateIsFocused: function (event) {
        if (event.type === 'click' || event.type === 'focusin') {
            this.set('isFocused', true);
        } else if (!this.get('layer').contains(event.relatedTarget)) {
            this.set('isFocused', false);
        }
    }.on('click', 'focusin', 'focusout'),
});

export { RadioGroupView };

import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { AbstractInputView } from './AbstractInputView.js';

/**
    Class: O.ToggleView

    Extends: O.AbstractInputView

    A toggle control view. The `value` property is two-way bindable,
    representing the state of the toggle (`true` => checked).
*/
const ToggleView = Class({
    Name: 'ToggleView',

    Extends: AbstractInputView,

    // --- Render ---

    /**
        Property: O.ToggleView#layerTag
        Type: String
        Default: 'label'

        Overrides default in <O.AbstractControlView#layerTag>.
    */
    layerTag: 'label',

    /**
        Property: O.ToggleView#baseClassName
        Type: String
        Default: 'v-Toggle'

        A string prepended to class names used by this view.
    */
    baseClassName: 'v-Toggle',

    /**
        Property: O.ToggleView#className
        Type: String
        Default: 'v-Toggle'

        Overrides default in <O.View#className>.
    */
    className: function () {
        const type = this.get('type');
        return (
            this.get('baseClassName') +
            (this.get('value') ? ' is-checked' : ' is-unchecked') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (this.get('isFocused') ? ' is-focused' : '') +
            (type ? ' ' + type : '')
        );
    }.property('baseClassName', 'type', 'value', 'isDisabled', 'isFocused'),

    drawControl() {
        return (this._domControl = el('input', {
            type: 'checkbox',
            id: this.get('id') + '-input',
            className: this.get('baseClassName') + '-input',
            checked: this.get('value'),
            disabled: this.get('isDisabled'),
            name: this.get('name'),
        }));
    },

    drawLabel(label) {
        return el('p', [label]);
    },

    /**
        Method: O.ToggleView#draw

        Overridden to draw toggle in layer. See <O.View#draw>.
    */
    draw(layer) {
        const control = this.drawControl();

        let label = this.get('label');
        if (label) {
            label = this.drawLabel(label);
        }

        let description = this.get('description');
        if (description) {
            description = this.drawDescription(description);
        }

        this.redrawInputAttributes(layer);
        this.redrawTabIndex(layer);

        return [
            control,
            label || description
                ? el(`div.${this.get('baseClassName')}-text`, [
                      label,
                      description,
                  ])
                : null,
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.ToggleView#redrawValue

        Updates the checked status of the DOM `<input type="checkbox">` to match
        the value property of the view.
    */
    redrawValue() {
        this._domControl.checked = this.get('value');
    },

    // --- Keep state in sync with render ---

    /**
        Method: O.ToggleView#change

        Update view state when the control state changes.
    */
    change: function (event) {
        const target = event.target;
        if (target === this._domControl) {
            this.userDidInput(target.checked);
        }
    }.on('change'),
});

export { ToggleView };

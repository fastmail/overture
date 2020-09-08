import { Class } from '../../core/Core';
import '../../foundation/ComputedProps'; // For Function#property
import '../../foundation/EventTarget'; // For Function#on
import '../../foundation/ObservableProps'; // For Function#observes
import { create as el } from '../../dom/Element';

import AbstractControlView from './AbstractControlView';

/**
    Class: O.CheckboxView

    Extends: O.AbstractControlView

    A checkbox control view. The `value` property is two-way bindable,
    representing the state of the checkbox (`true` => checked).
*/
const CheckboxView = Class({
    Extends: AbstractControlView,

    // --- Render ---

    type: '',

    isIndeterminate: false,

    /**
        Property: O.CheckboxView#className
        Type: String
        Default: 'v-Checkbox'

        Overrides default in <O.View#className>.
    */
    className: function () {
        const type = this.get('type');
        return (
            'v-Checkbox ' +
            (this.get('value') ? 'is-checked' : 'is-unchecked') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (type ? ' ' + type : '')
        );
    }.property('type', 'value', 'isDisabled'),

    /**
        Method: O.CheckboxView#draw

        Overridden to draw checkbox in layer. See <O.View#draw>.
    */
    draw(layer) {
        return [
            (this._domControl = el('input', {
                className: 'v-Checkbox-input',
                type: 'checkbox',
                checked: this.get('value'),
                indeterminate: this.get('isIndeterminate'),
            })),
            CheckboxView.parent.draw.call(this, layer),
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.CheckboxView#checkboxNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    checkboxNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('value', 'isIndeterminate'),

    /**
        Method: O.CheckboxView#redrawValue

        Updates the checked status of the DOM `<input type="checkbox">` to match
        the value property of the view.
    */
    redrawValue() {
        this._domControl.checked = this.get('value');
    },

    redrawIsIndeterminate() {
        this._domControl.indeterminate = this.get('isIndeterminate');
    },

    // --- Activate ---

    /**
        Method: O.CheckboxView#activate

        Overridden to toggle the checked status of the control. See
        <O.AbstractControlView#activate>.
    */
    activate() {
        if (!this.get('isDisabled')) {
            this.toggle('value');
        }
    },

    // --- Keep state in sync with render ---

    /**
        Method: O.CheckboxView#syncBackValue

        Observes `click` and `tap` events to update the view's `value` property
        when the user toggles the checkbox.
    */
    syncBackValue: function (event) {
        const isTap = event.type === 'tap';
        // Ignore simulated click events
        if (
            (isTap || !event.originalType) &&
            event.targetView === this &&
            !this.get('isDisabled')
        ) {
            const control = this._domControl;
            let value = control.checked;
            if (isTap || event.target !== control) {
                event.preventDefault();
                value = !value;
            }
            this.set('value', value);
        }
    }.on('click', 'tap'),
});

export default CheckboxView;

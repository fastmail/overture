import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { ToggleView } from './ToggleView.js';

/* { property, observes } from */
import '../../foundation/Decorators.js';

/**
    Class: O.CheckboxView

    Extends: O.ToggleView

    A checkbox control view. The `value` property is two-way bindable,
    representing the state of the checkbox (`true` => checked).
*/

const CheckboxView = Class({
    Name: 'CheckboxView',

    Extends: ToggleView,

    isIndeterminate: false,

    // --- Render ---

    baseClassName: 'v-Checkbox',

    drawControl() {
        const control = CheckboxView.parent.drawControl.call(this);
        control.indeterminate = this.get('isIndeterminate');
        return control;
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

    redrawIsIndeterminate() {
        this._domControl.indeterminate = this.get('isIndeterminate');
    },
});

export { CheckboxView };

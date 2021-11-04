import { Class } from '../../core/Core.js';
import { ToggleView } from './ToggleView.js';

import /* { property, observes } from */ '../../foundation/Decorators.js';

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

    /**
        Property: O.CheckboxView#className
        Type: String
        Default: 'v-Checkbox'

        Overrides default in <O.ToggleView#className> to prepend 'v-Checkbox'.
    */
    className: function () {
        return 'v-Checkbox ' + ToggleView.prototype.className.call(this);
    }.property(...ToggleView.prototype.className.dependencies),

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

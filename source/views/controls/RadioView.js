import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { ToggleView } from './ToggleView.js';

/* { property, on } from */
import '../../foundation/Decorators.js';

/**
    Class: O.RadioView

    Extends: O.AbstractControlView

    A radio-button control view. The `value` property is two-way bindable,
    representing the state of the button (`true` => selected).
*/
const RadioView = Class({
    Name: 'RadioView',

    Extends: ToggleView,

    // --- Render ---

    baseClassName: 'v-Radio',

    /**
        Method: O.RadioView#draw

        Overridden to draw radio button in layer. See <O.View#draw>.
    */
    drawControl() {
        return (this._domControl = el('input', {
            type: 'radio',
            id: this.get('id') + '-input',
            className: this.get('baseClassName') + '-input',
            checked: this.get('value'),
            disabled: this.get('isDisabled'),
            name: this.get('name'),
        }));
    },
});

export { RadioView };

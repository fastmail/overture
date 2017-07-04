import { Class } from '../../core/Core.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/EventTarget.js';  // For Function#on
import '../../foundation/ObservableProps.js';  // For Function#observes

import AbstractControlView from './AbstractControlView.js';

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

    /**
        Property: O.CheckboxView#className
        Type: String
        Default: 'v-Checkbox'

        Overrides default in <O.View#className>.
    */
    className: function () {
        const type = this.get( 'type' );
        return 'v-Checkbox ' +
            ( this.get( 'value' ) ? 'is-checked' : 'is-unchecked' ) +
            ( this.get( 'isDisabled' ) ? ' is-disabled' : '' ) +
            ( type ? ' ' + type : '' );
    }.property( 'type', 'value', 'isDisabled' ),

    /**
        Method: O.CheckboxView#draw

        Overridden to draw checkbox in layer. See <O.View#draw>.
    */
    draw ( layer, Element, el ) {
        return [
            this._domControl = el( 'input', {
                className: 'v-Checkbox-input',
                type: 'checkbox',
                checked: this.get( 'value' ),
            }),
            CheckboxView.parent.draw.call( this, layer, Element, el ),
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.CheckboxView#checkboxNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    checkboxNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'value' ),

    /**
        Method: O.CheckboxView#redrawValue

        Updates the checked status of the DOM `<input type="checkbox">` to match
        the value property of the view.
    */
    redrawValue () {
        this._domControl.checked = this.get( 'value' );
    },

    // --- Activate ---

    /**
        Method: O.CheckboxView#activate

        Overridden to toggle the checked status of the control. See
        <O.AbstractControlView#activate>.
    */
    activate () {
        if ( !this.get( 'isDisabled' ) ) {
            this.toggle( 'value' );
        }
    },

    // --- Keep state in sync with render ---

    /**
        Method: O.CheckboxView#syncBackValue

        Observes `click` and `tap` events to update the view's `value` property
        when the user toggles the checkbox.
    */
    syncBackValue: function ( event ) {
        const isTap = ( event.type === 'tap' );
        // Ignore simulated click events
        if ( ( isTap || !event.originalType ) &&
                event.targetView === this &&
                !this.get( 'isDisabled' ) ) {
            const control = this._domControl;
            let value = control.checked;
            if ( isTap || event.target !== control ) {
                event.preventDefault();
                value = !value;
            }
            this.set( 'value', value );
        }
    }.on( 'click', 'tap' ),
});

export default CheckboxView;

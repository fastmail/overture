// -------------------------------------------------------------------------- \\
// File: CheckboxView.js                                                      \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, AbstractControlView.js              \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.CheckboxView

    Extends: O.AbstractControlView

    A checkbox control view. The `value` property is two-way bindable,
    representing the state of the checkbox (`true` => checked).
*/
var CheckboxView = NS.Class({

    Extends: NS.AbstractControlView,

    // --- Render ---

    /**
        Property: O.CheckboxView#className
        Type: String
        Default: 'CheckboxView'

        Overrides default in <O.View#className>.
    */
    className: function () {
        return 'CheckboxView' +
            ( this.get( 'value' ) ? ' checked' : '' );
    }.property( 'value' ),

    /**
        Method: O.CheckboxView#draw

        Overridden to draw checkbox in layer. See <O.View#draw>.
    */
    draw: function ( layer, Element, el ) {
        return [
            this._domControl = el( 'input', {
                type: 'checkbox',
                checked: this.get( 'value' )
            }),
            CheckboxView.parent.draw.call( this, layer, Element, el )
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
    redrawValue: function () {
        this._domControl.checked = this.get( 'value' );
    },

    // --- Activate ---

    /**
        Method: O.CheckboxView#activate

        Overridden to toggle the checked status of the control. See
        <O.AbstractControlView#activate>.
    */
    activate: function () {
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
        var isTap = ( event.type === 'tap' );
        // Ignore simulated click events
        if ( ( isTap || !event.originalType ) && !this.get( 'isDisabled' ) ) {
            var control = this._domControl,
                value = control.checked;
            if ( isTap ) {
                event.preventDefault();
                value = !value;
            }
            this.set( 'value', value );
        }
    }.on( 'click', 'tap' )
});

NS.CheckboxView = CheckboxView;

}( this.O ) );

// -------------------------------------------------------------------------- \\
// File: RadioView.js                                                         \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, CheckboxView.js                     \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.RadioView

    Extends: O.AbstractControlView

    A radio-button control view. The `value` property is two-way bindable,
    representing the state of the button (`true` => selected).
*/
var RadioView = NS.Class({

    Extends: NS.AbstractControlView,

    // --- Render ---

    type: '',

    /**
        Property: O.RadioView#className
        Type: String
        Default: 'v-Radio'

        Overrides default in <O.View#className>.
    */
    className: function () {
        var type = this.get( 'type' );
        return 'v-Radio ' +
            ( this.get( 'value' ) ? 'is-checked' : 'is-unchecked' ) +
            ( this.get( 'isDisabled' ) ? ' is-disabled' : '' ) +
            ( type ? ' ' + type : '' );
    }.property( 'type', 'value', 'isDisabled' ),

    /**
        Method: O.RadioView#draw

        Overridden to draw radio button in layer. See <O.View#draw>.
    */
    draw: function ( layer, Element, el ) {
        return [
            this._domControl = el( 'input', {
                className: 'v-Radio-input',
                type: 'radio',
                checked: this.get( 'value' )
            }),
            RadioView.parent.draw.call( this, layer, Element, el )
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.RadioView#radioNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    radioNeedsRedraw: NS.CheckboxView.prototype.checkboxNeedsRedraw,

    /**
        Method: O.RadioView#redrawValue

        Updates the checked status of the DOM `<input type="radio">` to match
        the value property of the view.
    */
    redrawValue: NS.CheckboxView.prototype.redrawValue,

    // --- Keep state in sync with render ---

    /**
        Method: O.RadioView#activate

        Overridden to set the view as selected. See
        <O.AbstractControlView#activate>.
    */
    activate: function () {
        if ( !this.get( 'isDisabled' ) ) {
            this.set( 'value', true );
        }
    }.on( 'click' )
});

NS.RadioView = RadioView;

}( O ) );

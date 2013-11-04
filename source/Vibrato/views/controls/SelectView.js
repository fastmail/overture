// -------------------------------------------------------------------------- \\
// File: SelectView.js                                                        \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, AbstractControlView.js              \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.SelectView

    Extends: O.AbstractControlView

    A view representing an HTML `<select>` menu. The `value` property is two-way
    bindable, representing the selected option.
*/
var SelectView = NS.Class({

    Extends: NS.AbstractControlView,

    /**
        Property: O.SelectView#options
        Type: Array

        The array of options to present in the select menu. Each item in the
        array should be an object, with the following properties:

        text       - {String} The text to display for the item
        value      - {*} The value for the <O.SelectView#value> property to take
                     when this item is selected.
        isDisabled - {Boolean} (optional) If true, the option will be disabled
                     (unselectable). Defaults to false if not present.
    */
    options: [],

    // --- Render ---

    /**
        Property: O.SelectView#className
        Type: String
        Default: 'SelectView'

        Overrides default in <O.View#className>.
    */
    className: 'SelectView',

    /**
        Method: O.SelectView#draw

        Overridden to draw select menu in layer. See <O.View#draw>.
    */
    draw: function ( layer, Element, el ) {
        var control = this._domControl =
            this._drawSelect( this.get( 'options' ) );
        return [
            SelectView.parent.draw.call( this, layer, Element, el ),
            control
        ];
    },

    /**
        Method (private): O.SelectView#_drawSelect

        Creates the DOM elements for the `<select>` and all `<option>` children.

        Parameters:
            options - {Array} Array of option objects.

        Returns:
            {Element} The `<select>`.
    */
    _drawSelect: function ( options ) {
        var selected = this.get( 'value' ),
            el = NS.Element.create,
            select = el( 'select', { disabled: this.get( 'isDisabled' ) },
                options.map( function ( option, i ) {
                    return el( 'option', {
                        text: option.text,
                        value: i,
                        selected: option.value === selected,
                        disabled: !!option.isDisabled
                    });
                })
            );
        return select;
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.SelectView#selectNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    selectNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'options', 'value' ),

    /**
        Method: O.RadioView#redrawOptions

        Updates the DOM representation when the <O.RadioView#options> property
        changes.
    */
    redrawOptions: function ( layer ) {
        var select = this._drawSelect( this.get( 'options' ) );
        layer.replaceChild( select, this._domControl );
        this._domControl = select;
    },

    /**
        Method: O.RadioView#redrawValue

        Selects the corresponding option in the select when the
        <O.RadioView#value> property changes.
    */
    redrawValue: function () {
        var value = this.get( 'value' ),
            options = this.get( 'options' ),
            l = options.length;

        while ( l-- ) {
            if ( options[l].value === value ) {
                this._domControl.value = l + '';
                return;
            }
        }
    },

    // --- Keep state in sync with render ---

    /**
        Method: O.RadioView#syncBackValue

        Observes the `change` event to update the view's `value` property when
        the user selects a different option.
    */
    syncBackValue: function ( event ) {
        var i = this._domControl.selectedIndex;
        this.set( 'value', this.get( 'options' ).getObjectAt( i ).value );
    }.on( 'change' )
});

NS.SelectView = SelectView;

}( this.O ) );

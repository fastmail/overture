// -------------------------------------------------------------------------- \\
// File: Validate.js                                                          \\
// Module: Validate                                                           \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Mixin: O.Validate

    Mixin to use when an object can be in either a valid or an invalid state,
    with a set of functions to apply to determine which state it is in.

    Any object including O.Validate must also inclue <O.ObservableProps>.
*/

var Validate = {
    /**
        Method: O.Validate#initValidate

        Initialises any validators to run at the appropriate times. You should
        call this during the init method of your object including O.Validate.
    */
    initValidate: function () {
        var type;
        for ( type in this.validateOn ) {
            if ( /^event:/.test( type ) ) {
                this.on( type.slice( 6 ), this, '_validate' );
            } else {
                this.addObserverForKey( type, this, '_validate' );
            }
        }
    },

    /**
        Property: O.Validate#isValid
        Type: Boolean

        False if the validators last rejected the object's state
    */
    isValid: true,
    /**
        Property: O.Validate#
        Type: Object.<String,Function>

        A map of names to functions that validate the object. The functions will
        be called with this object as the `this` parameter, and the `value`
        property of the object as the sole argument. They must return a boolean
        value indicating whether the validation succeeded.
    */
    validators: {},
    /**
        Property: O.Validate#validateOn
        Type: Object.<String,Array.<String>>

        A map of properties to observe to an array of validator names to be run
        when the property changes.
    */
    validateOn: {},
    /**
        Property: O.Validate#validityError
        Type: String

        A string describing the error causing validation to fail. This should be
        set by the validator if it fails.
    */
    validityError: '',

    /**
        Method (private): O.Validate#_validate

        Runs the validation methods defined for a particular event or property
        change, setting the isValid property to reflect the new state of the
        object.

        Parameters:
            obj - {(Event|*)} (optional) If an event is fired, the type property
                  of this object is used to determine the set of validators to
                  run.
            key - {String} (optional) If this is supplied (and it must be the
                  second argument), it is used to determine the set of
                  validators to run.
    */
    _validate: function ( obj, key ) {
        var validators = this.get( 'validators' ),
            toUse = this.get( 'validateOn' )[
                key || ( 'event:' + ( obj.type || 'blur' ) ) ],
            value = this.get( 'value' ),
            isValid = true,
            i, l;

        for ( i = 0, l = toUse.length; i < l; i += 1 ) {
            isValid = isValid && validators[ toUse[i] ].call( this, value );
            // If state is invalid, no point in validating further.
            if ( !isValid ) { break; }
        }
        this.set( 'isValid', isValid );
    }
};

NS.Validate = Validate;

}( this.O ) );

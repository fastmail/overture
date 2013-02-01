// -------------------------------------------------------------------------- \\
// File: Validate.js                                                          \\
// Module: Validate                                                           \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Mixin: O.Validate

    Objects that can be in either a valid or invalid state should include the
    O.Validate mixin. This makes it easy to set up validation functions to run
    when triggered by an event or property change, and provides a consistent
    interface for other objects to get the validity state and error description.

    Any object including O.Validate *must* also inclue <O.ObservableProps>.
*/

var Validate = {
    /**
        Method: O.Validate#initValidate

        Initialises any validation functions to run at the appropriate times.
        You *must* call this during the init method of your class including
        O.Validate.
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

        False if the validation functions last rejected the object's state
    */
    isValid: true,
    /**
        Property: O.Validate#validators
        Type: Object.<String,Function>

        A map of names to functions that validate the object. The functions will
        be called with this object as the `this` parameter, and the `value`
        property of the object as the sole argument. They must return a boolean
        value, true if and only if the object conforms to the constraint being
        tested. If they return false, before doing so they should set the
        `validityError` attribute on the object (the `this` parameter within the
        function), with a string describing the error.
    */
    validators: {},
    /**
        Property: O.Validate#validateOn
        Type: Object.<String,Array.<String>>

        A map of properties to observe to an array of validation function names
        (as specified in #Validators) to be run when the property changes. To
        validate when an event is fired, use `"event:" + errorType` as the
        property name, e.g. `event:blur`.
    */
    validateOn: {},
    /**
        Property: O.Validate#validityError
        Type: String

        A string describing the error causing validation to fail. This should be
        set by a validation function if it fails.
    */
    validityError: '',

    /**
        Method (private): O.Validate#_validate

        Runs the validation methods defined for a particular event or property
        change, setting the isValid property to reflect the new state of the
        object.

        Parameters:
            obj - {(Event|*)} (optional) If an event is fired, the type property
                  of this object is used to determine the set of validation
                  functions to run.
            key - {String} (optional) If this is supplied (and it must be the
                  second argument), it is used to determine the set of
                  validation functions to run.
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
            // If the state is invalid, no point in validating further.
            if ( !isValid ) { break; }
        }
        this.set( 'isValid', isValid );
    }
};

NS.Validate = Validate;

}( this.O ) );

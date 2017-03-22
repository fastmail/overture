/**
    Namespace: O.Transform

    Holds a number of useful functions for transforming values, for use with
    <O.Binding>.
*/
export default {
    /**
        Function: O.Transform.toBoolean

        Converts the given value to a Boolean

        Parameter:
            value - {*} The value to transform.

        Returns:
            {Boolean} The numerical value.
    */
    toBoolean( value ) {
        return !!value;
    },

    /**
        Function: O.Transform.toString

        Converts the given value to a String

        Parameter:
            value - {*} The value to transform.

        Returns:
            {String} The string value.
    */
    toString( value ) {
        return value != null ? value + '' : '';
    },

    /**
        Function: O.Transform.toInt

        Converts the given value to an integer

        Parameter:
            value - {*} The value to transform.

        Returns:
            {Number} The integral numerical value.
    */
    toInt( value ) {
        return parseInt( value, 10 ) || 0;
    },

    /**
        Function: O.Transform.toFloat

        Converts the given value to a floating point Number.

        Parameter:
            value - {*} The value to transform.

        Returns:
            {Number} The numerical value.
    */
    toFloat( value ) {
        return parseFloat( value );
    },

    /**
        Function: O.Transform.invert

        Converts the given value to a Boolean then inverts it.

        Parameter:
            value - {*} The value to transform.

        Returns:
            {Boolean} The inverse Boolean value.
    */
    invert( value ) {
        return !value;
    },

    /**
        Function: O.Transform#defaultValue

        Returns a function which will transform `undefined` into the default
        value, but will pass through any other value untouched.

        Parameters:
            value - {*} The default value to use.
    */
    defaultValue( value ) {
        return function ( v ) {
            return v !== undefined ? v : value;
        };
    },

    /**
        Function: O.Transform.undefinedToNull

        Converts an undefined value into null, passes others through unchanged.

        Parameter:
            value - {*} The value to transform.

        Returns:
            {*} The value or null if the value is undefined.
    */
    undefinedToNull( value ) {
        return value === undefined ? null : value;
    },

    /**
        Function: O.Transform.isEqualToValue

        Returns a function which will compare a given value to the value

        Parameter:
            value - {*} The value to compare to.

        Returns:
            {Function} A function which compares its first argument to the value
            given to this function, returning true if equal or false otherwise.
            Or, if the sync is in reverse, returns the given value if true or
            undefined if false.
    */
    isEqualToValue( value ) {
        return function ( syncValue, syncForward ) {
            return syncForward ?
                syncValue === value :
                syncValue ? value : undefined;
        };
    },
};

/**
    Class: O.ValidationError

    Represents an error in an attribute value of a record.

    Parameters:
        type        - {Number} The error code.
        explanation - {String} A description of the error (normally used to
                      present to the user).
*/
const ValidationError = function ( type, explanation ) {
    this.type = type;
    this.explanation = explanation;
};

ValidationError.REQUIRED = 1;
ValidationError.TOO_SHORT = 2;
ValidationError.TOO_LONG = 4;
ValidationError.INVALID_CHAR = 8;
ValidationError.FIRST_CUSTOM_ERROR = 16;

export default ValidationError;

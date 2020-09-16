/**
    Class: O.ValidationError

    Represents an error in an attribute value of a record.

    Parameters:
        type        - {Number} The error code.
        explanation - {String} A description of the error (normally used to
                      present to the user).
*/
class ValidationError {
    constructor(type, explanation) {
        this.type = type;
        this.explanation = explanation;
    }
}

const REQUIRED = 1;
const TOO_SHORT = 2;
const TOO_LONG = 4;
const INVALID_CHAR = 8;
const FIRST_CUSTOM_ERROR = 16;

export {
    ValidationError,
    REQUIRED,
    TOO_SHORT,
    TOO_LONG,
    INVALID_CHAR,
    FIRST_CUSTOM_ERROR,
};

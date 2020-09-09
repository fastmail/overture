/**
    Function: limit

    Limits the number to be within the given range.

    Parameters:
        number - {number} The number.
        min    - {number} The minimum allowed value.
        max    - {number} The maximum allowed value.

    Returns:
        {Number} The nearest number to the current value within the allowed
        range.
*/
const limit = (number, min, max) =>
    number < min ? min : number > max ? max : number;

/**
    Function: mod

    Returns the number mod n.

    Parameters:
        number - {number}
        n      - {number}

    Returns:
        {Number} The number mod n.
*/
const mod = (number, n) => {
    const m = number % n;
    return m < 0 ? m + n : m;
};

export { limit, mod };

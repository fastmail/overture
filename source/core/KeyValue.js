/**
    Function: KeyValue.keyOf

    Searches the object and returns the first key it finds which maps to the
    given value (as determined by ===).

    Parameters:
        object - {Object} The object to search.
        value  - {*} The value to search for.

    Returns:
        {String|null} The key for that value in the object.
        Null is returned if the value is not found.
*/
const keyOf = (object, value) => {
    for (const key in object) {
        if (object[key] === value) {
            return key;
        }
    }
    return null;
};

/**
    Function: KeyValue.filter

    Takes two objects and returns a new object which contains all the
    properties of the first for which the same key has a truthy value in the
    second.

    Parameters:
        object   - {Object} The object to copy properties from.
        include  - {Object} The object to check for a truthy key value in
                   before copying the property.

    Returns:
        {Object} The filtered object.
*/
const filter = (object, include) => {
    const result = {};
    for (const key in object) {
        if (include[key]) {
            result[key] = object[key];
        }
    }
    return result;
};

/**
    Function: KeyValue.zip

    Takes two arrays and returns an object with keys from the first array
    and values taken from the corresponding position in the second array.

    Parameters:
        keys   - {String[]} The array of keys.
        values - {Array} The array of values.

    Returns:
        {Object} The object mapping keys to values.
*/
const zip = (keys, values) => {
    const object = {};
    for (let i = 0, l = Math.min(keys.length, values.length); i < l; i += 1) {
        object[keys[i]] = values[i];
    }
    return object;
};

/**
    Function: KeyValue.fromQueryString

    Converts a URL query string (the part after the '?') into an object of
    key/value pairs.

    Parameters:
        query - {String} The key/value pairs in query string form.

    Returns:
        {Object} The key/value pairs in object form.
*/
const fromQueryString = (query) => {
    const result = {};
    query.split('&').forEach((pair) => {
        const parts = pair.split('=').map(decodeURIComponent);
        result[parts[0]] = parts[1];
    });
    return result;
};

export { keyOf, filter, zip, fromQueryString };

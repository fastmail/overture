Object.assign( Object, {
    /**
        Function: Object.keyOf

        Searches the object and returns the first key it finds which maps to the
        given value (as determined by ===).

        Parameters:
            object - {Object} The object to search.
            value  - {*} The value to search for.

        Returns:
            {String|undefined} The key for that value in the object.
            Undefined is returned if the value is not found.
    */
    keyOf ( object, value ) {
        for ( const key in object ) {
            if ( object[ key ] === value ) {
                return key;
            }
        }
    },

    /**
        Function: Object.filter

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
    filter ( object, include ) {
        const result = {};
        for ( const key in object ) {
            if ( include[ key ] ) {
                result[ key ] = object[ key ];
            }
        }
        return result;
    },

    /**
        Function: Object.zip

        Takes two arrays and returns an object with keys from the first array
        and values taken from the corresponding position in the second array.

        Parameters:
            keys   - {String[]} The array of keys.
            values - {Array} The array of values.

        Returns:
            {Object} The object mapping keys to values.
    */
    zip ( keys, values ) {
        let l = Math.min( keys.length, values.length );
        const object = {};
        while ( l-- ) {
            object[ keys[l] ] = values[l];
        }
        return object;
    },

    /**
        Function: Object.fromQueryString

        Converts a URL query string (the part after the '?') into an object of
        key/value pairs.

        Parameters:
            query - {String} The key/value pairs in query string form.

        Returns:
            {Object} The key/value pairs in object form.
    */
    fromQueryString ( query ) {
        const result = {};
        query.split( '&' ).forEach( function ( pair ) {
            const parts = pair.split( '=' ).map( decodeURIComponent );
            result[ parts[0] ] = parts[1];
        });
        return result;
    },
});

// TODO(cmorgan/modulify): do something about these exports:
// Object.keyOf, Object.filter, Object.zip, Object.fromQueryString

import './Core.js';  // For Function#extend

Object.extend({
    /**
        Function: Object.values

        Returns an array of values for all enumerable properties defined
        explicitly on the object (not its prototype).

        Parameters:
            object - {Object} The object to get the array of values from.

        Returns:
            {Array} The list of values.
    */
    values: function ( object ) {
        const values = [];
        for ( const key in object ) {
            if ( object.hasOwnProperty( key ) ) {
                values.push( object[ key ] );
            }
        }
        return values;
    },

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
    keyOf: function ( object, value ) {
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
    filter: function ( object, include ) {
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
    zip: function ( keys, values ) {
        let l = Math.min( keys.length, values.length );
        const obj = {};
        while ( l-- ) {
            obj[ keys[l] ] = values[l];
        }
        return obj;
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
    fromQueryString: function ( query ) {
        const result = {};
        query.split( '&' ).forEach( function ( pair ) {
           const parts = pair.split( '=' ).map( decodeURIComponent );
           result[ parts[0] ] = parts[1];
        });
        return result;
    },
});

// TODO(cmorgan/modulify): do something about these exports: Object.values,
// Object.keyOf, Object.filter, Object.zip, Object.fromQueryString

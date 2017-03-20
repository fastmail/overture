// I know this looks bad, but the defined ES6 module semantics actually make
// this OK. (The short version is that circular references are just fine and
// tend to work roughly as you’d expect if you didn’t think about them at all.
// (If you *do* stop to think about such things you may well run off screaming
// into the sunset. You're quite at liberty to do this, only don't blame me.))
// The alternative is attempting a run-time import with `System.import`, but
// plenty of tools won't give that method the time of day; it's safer to just
// rock back on your heels, muttering that everything will be OK.
import { i18n } from '../localisation/LocaleController.js';

/**
    Function: O.sortByProperties

    Creates a comparison function which takes two objects and returns -1/0/1 to
    indicate whether the first object is before or after the other. Comparison
    is made by considering each of the properties in the array in turn on the
    two objects until the objects have non-equal values for a property. If the
    property values are integer like strings, they will first be converted to
    numbers for comparison. Other strings will be compared case-insensitively.

    Parameters:
        properties - {String[]} The properties to sort the objects by, in
                     order of precedence. Can also supply just a String for one
                     property.

    Returns:
        {Function} This function may be passed to the Array#sort method to
        sort the array of objects by the properties specified.
*/
var isNumber = /^\d+$/;
export default function sortByProperties ( properties ) {
    if ( !( properties instanceof Array ) ) {
        properties = [ properties ];
    }
    var l = properties.length;

    return function ( a, b ) {
        var hasGet = !!a.get,
            i, prop, aVal, bVal, type;
        for ( i = 0; i < l; i += 1 ) {
            prop = properties[i];
            aVal = hasGet ? a.get( prop ) : a[ prop ];
            bVal = hasGet ? b.get( prop ) : b[ prop ];
            type = typeof aVal;

            // Must be the same type
            if ( type === typeof bVal ) {
                if ( type === 'boolean' && aVal !== bVal ) {
                    return aVal ? -1 : 1;
                }
                if ( type === 'string' ) {
                    if ( isNumber.test( aVal ) && isNumber.test( bVal ) ) {
                        aVal = +aVal;
                        bVal = +bVal;
                    } else if ( i18n ) {
                        return i18n.compare( aVal, bVal );
                    }
                }
                if ( aVal < bVal ) {
                    return -1;
                }
                if ( aVal > bVal ) {
                    return 1;
                }
            }
        }
        return 0;
    };
}

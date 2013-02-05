// -------------------------------------------------------------------------- \\
// File: RelativeDate.js                                                      \\
// Module: Localisation                                                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

Date.implement({
    /**
        Method: Date#relativeTo

        Returns the difference in time between the date given in the sole
        argument (or now if not supplied) and this date, in a human friendly,
        localised form. e.g. 5 hours 3 minutes ago.

        Parameters:
            date   - {Date} Date to compare it to.
            approx - {Boolean} (optional) If true, only return a string for the
                     most significant part of the relative time (e.g. just "5
                     hours ago" instead of "5 hours 34 mintues ago").

        Returns:
            {String} Relative date string.
    */
    relativeTo: function ( date, approx ) {
        if ( !date ) { date = new Date(); }

        var diffSeconds = ( date - this ) / 1000,
            isFuture = ( diffSeconds < 0 ),
            time;

        if ( isFuture ) {
            diffSeconds = -diffSeconds;
        }

        if ( diffSeconds < 60 ) {
            time = NS.loc( 'less than a minute' );
        } else if ( diffSeconds < 3600 ) {
            time = NS.loc( '[*2,_1,%n minute,%n minutes]',
                ~~( diffSeconds / 60 ) );
        } else if ( diffSeconds < 86400 ) {
            time = NS.loc( '[*2,_1,%n hour,%n hours,] [*2,_2,%n minute,%n minutes,]',
                ~~( diffSeconds / 3600 ),
                approx ? 0 : ~~( diffSeconds / 60 ) % 60 );
        } else if ( diffSeconds < 604800 ) {
            time = NS.loc( '[*2,_1,%n day,%n days,] [*2,_2,%n hour,%n hours,]',
                ~~( diffSeconds / 86400 ),
                approx ? 0 : ~~( diffSeconds / 3600 ) % 24 );
        } else if ( diffSeconds < 3628800 ) {
            time = NS.loc( '[*2,_1,%n week,%n weeks,] [*2,_2,%n day,%n days,]',
                ~~( diffSeconds / 604800 ),
                approx ? 0 : ~~( diffSeconds / 86400 ) % 7 );
        } else {
            var years = date.getFullYear() - this.getFullYear(),
                months = date.getMonth() - this.getMonth();

            if ( isFuture ) {
                years = -years;
                months = -months;
            }
            if ( months < 0 ) {
                years -= 1;
                months += 12;
            }
            time =
                NS.loc( '[*2,_1,%n year,%n years,] [*2,_2,%n month,%n months,]',
                    years, months );
        }

        time = time.trim();

        return isFuture ?
            NS.loc( '[_1] from now', time ) : NS.loc( '[_1] ago', time );
    }
});

}( this.O ) );

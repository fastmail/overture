// -------------------------------------------------------------------------- \\
// File: Stylesheet.js                                                        \\
// Module: DOM                                                                \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS ) {

NS.Stylesheet = {
    create: function ( id, data ) {
        var doc = document,
            head = doc.documentElement.firstChild,
            style = NS.Element.create( 'style', {
                type: 'text/css',
                id: id
            });

        if ( style.styleSheet ) {
            // IE8: must append to document BEFORE adding styles
            // or you get the IE7 CSS parser!
            head.appendChild( style );
            style.styleSheet.cssText = data;
        } else {
            // Everyone else
            style.appendChild( doc.createTextNode( data ) );
            head.appendChild( style );
        }
        return style;
    }
};

}( O ) );
// -------------------------------------------------------------------------- \\
// File: Stylesheet.js                                                        \\
// Module: DOM                                                                \\
// Requires: Core, Element.js                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

/**
    Namespace: O.Stylesheet

    The O.Stylesheet namespace contains helper functions for dealing with CSS
    stylesheets.
*/
NS.Stylesheet = {
    /**
        Function: O.Stylesheet.create

        Injects CSS into the document by creating a new stylesheet and appending
        it to the document.

        Parameters:
            id  - {String} The id to give the node in the document.
            css - {String} The CSS to insert into the stylesheet.

        Returns:
            {Element} The <style> node that was created.
    */
    create: function ( id, css ) {
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
            style.styleSheet.cssText = css;
        } else {
            // Everyone else
            style.appendChild( doc.createTextNode( css ) );
            head.appendChild( style );
        }
        return style;
    }
};

}( this.O ) );

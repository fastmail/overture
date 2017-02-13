// -------------------------------------------------------------------------- \\
// File: Stylesheet.js                                                        \\
// Module: DOM                                                                \\
// Requires: Core, Element.js                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS, document ) {

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
        var style = NS.Element.create( 'style', {
            type: 'text/css',
            id: id,
            text: css
        });
        document.head.appendChild( style );
        return style;
    }
};

}( O, document ) );

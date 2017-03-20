/*global document */

import Element from './Element.js';

/**
    Namespace: O.Stylesheet

    The O.Stylesheet namespace contains helper functions for dealing with CSS
    stylesheets.
*/
export default {
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
        const style = Element.create( 'style', {
            type: 'text/css',
            id: id,
            text: css,
        });
        document.head.appendChild( style );
        return style;
    },
};

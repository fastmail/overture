/*global document */

import { Class } from '../core/Core.js';
import Object from '../foundation/Object.js';
import Stylesheet from '../dom/Stylesheet.js';
import { loc } from '../localisation/LocaleController.js';

/**
    Class: O.ThemeManager

    Extends: O.Object

    The O.ThemeManager class manages the themes for an application. A theme
    consists of stylesheets and images. These can be loaded in stages and
    hotswapped if themes are changed.
*/
const ThemeManager = Class({

    Extends: Object,

    init( mixin ) {
        this._images = { all: {} };
        this._styles = { all: {} };
        this._activeStylesheets = {};

        this.theme = '';

        ThemeManager.parent.init.call( this, mixin );
    },

    /**
        Property: O.ThemeManager#theme
        Type: String

        The name of the currently active theme.
    */

    /**
        Method: O.ThemeManager#changeTheme

        Replaces the stylesheets in the document from the old theme with
        equivalents from the new one.

        Parameters:
            oldTheme - {String} The name of the theme being deactivated.
            newTheme - {String} The name of the newly active theme.
    */
    changeTheme( oldTheme, newTheme ) {
        const active = this._activeStylesheets;
        for ( const id in active ) {
            if ( active[ id ] ) {
                this.addStylesheet( id, newTheme );
                this.removeStylesheet( id, oldTheme );
            }
        }
    },

    /**
        Method: O.ThemeManager#imageDidLoad

        Registers an image with the theme manager, making it available via
        <#getImageSrc> or in any stylesheets injected later into the page.

        Parameters:
            theme - {String} The name of the theme this image belongs to.
                    If applicable to all themes, use the string 'all'.
            id    - {String} An id for the image.
            data  - {String} The base64 encoded data for the image.
    */
    imageDidLoad( theme, id, data ) {
        const themeImages = this._images[ theme ] ||
            ( this._images[ theme ] = {} );
        themeImages[ id ] = data;
        return this;
    },

    /**
        Method: O.ThemeManager#stylesheetDidLoad

        Registers an stylesheet with the theme manager, making it available to
        be injected by a call to <#addStylesheet>.

        Parameters:
            theme - {String} The name of the theme this image belongs to.
                    If applicable to all themes, use the string 'all'.
            id    - {String} An id for the image.
            data  - {String} The base64 encoded data for the image.
    */
    stylesheetDidLoad( theme, id, data ) {
        const themeStyles = this._styles[ theme ] ||
            ( this._styles[ theme ] = {} );
        themeStyles[ id ] = data;
        return this;
    },

    /**
        Method: O.ThemeManager#addStylesheet

        Injects a new stylesheet into the page. Will first substitute in the
        data for all images it has loaded into memory.

        Parameters:
            id    - {String} The id to give the stylesheet.
            theme - {String} (optional) The theme to choose; defaults to the
                    currently set theme.

        Returns:
            {O.ThemeManager} Returns self.
    */
    addStylesheet( id, theme ) {
        if ( !theme ) { theme = this.get( 'theme' ); }

        const styles = this._styles[ theme ];
        let data = styles[ id ] || this._styles.all[ id ];
        const images = this._images[ theme ] || {};
        const themeIndependentImages = this._images.all;
        const active = this._activeStylesheets;

        if ( data ) {
            // Substitute in images.
            data = data.replace( /url\(([^)]+)\)/g, ( url, src ) => {
                let imageData =
                        images[ src ] ||
                        themeIndependentImages[ src ] ||
                        loc( src );
                if ( /\.svg$/.test( src ) ) {
                    imageData = 'data:image/svg+xml;charset=UTF-8,' +
                        encodeURIComponent( imageData );
                }
                return 'url(' + ( imageData || src ) + ')';
            });
            Stylesheet.create( theme + '-' + id, data );
            active[ id ] = ( active[ id ] || 0 ) + 1;
        }

        return this;
    },

    /**
        Method: O.ThemeManager#removeStylesheet

        Removes a previously added stylesheet from the page.

        Parameters:
            id   - {String} The id of the stylesheet to remove.

        Returns:
            {O.ThemeManager} Returns self.
    */
    removeStylesheet( id, theme ) {
        if ( !theme ) { theme = this.get( 'theme' ); }

        const sheet = document.getElementById( theme + '-' + id );
        if ( sheet ) {
            sheet.parentNode.removeChild( sheet );
            this._activeStylesheets[ id ] -= 1;
        }

        return this;
    },

    /**
        Method: O.ThemeManager#getImageSrc

        Gets the (data) url for a loaded image.

        Parameters:
            id - {String} The id of the image.

        Returns:
            {(String|null)} A data URI for the requested image if the data is
            available, otherwise null.
    */
    getImageSrc( id ) {
        const _images = this._images;
        const themeImages = _images[ this.get( 'theme' ) ] || {};
        const themeIndependentImages = _images.all;
        return themeImages[ id ] || themeIndependentImages[ id ] || null;
    },
});

export default ThemeManager;

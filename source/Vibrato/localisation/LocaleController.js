// -------------------------------------------------------------------------- \\
// File: LocaleController.js                                                  \\
// Module: Localisation                                                       \\
// Requires: Core, Locale.js                                                  \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

/**
    Module: Localisation

    The Localisation module provides classes for localising an interface.
*/

/**
    Class: O.LocaleController

    Alias: O.i18n

    This static class has methods for localising strings or dates and for
    registering and setting the user interface locale.
*/

/**
    Property (private): O.LocaleController-locales
    Type: Object

    Stores the loaded <O.Locale> instances.
*/
var locales = {
    xx: new NS.Locale({ code: 'xx' })
};

/**
    Property (private): O.LocaleController-active
    Type: O.Locale

    The active locale.
*/
var active = locales.xx;

var LocaleController = {
    /**
        Property: O.LocaleController.activeLocaleCode
        Type: String

        The locale code for the active locale.
    */
    activeLocaleCode: 'xx',

    /**
        Method: O.LocaleController.addLocale

        Registers a resource bundle with the class.

        Parameters:
            locale - {O.Locale} The locale instance containing translated
                     strings, date formats etc.

        Returns:
            {O.LocaleController} Returns self.
    */
    addLocale: function ( locale ) {
        locales[ locale.code ] = locale;
        return this;
    },

    /**
        Method: O.LocaleController.setLocale

        Sets a different locale as the active one. Will only have an effect if
        the resource bundle for this locale has already been loaded and
        registered with a call to addLocale. Future calls to localise() etc.
        will now use the resources from this locale.

        Parameters:
            localeCode - {String} The code for the locale to make active.

        Returns:
            {O.LocaleController} Returns self.
    */
    setLocale: function ( localeCode ) {
        if ( locales[ localeCode ] ) {
            active = locales[ localeCode ];
            this.activeLocaleCode = localeCode;
        }
        return this;
    },

    /**
        Method: O.LocaleController.getLocale

        Returns a previously added locale object.

        Parameters:
            localeCode - {String} (optional) The code for the locale to return.
                       If not specified, the currently active locale will be
                       returned.

        Returns:
            {Locale|null} Returns the locale object (null if not present).
    */
    getLocale: function ( localeCode ) {
        return localeCode ? locales[ localeCode ] || null : active;
    },

    /**
        Function: O.LocaleController.get

        Gets a property from the active locale.

        Parameters:
            key - {String} The name of the property to fetch.

        Returns:
            {*} The value for that key.
    */
    get: function ( key ) {
        return active[ key ];
    },

    /**
        Function: O.LocaleController.localise

        Get a localised version of a string.

        Alias: O.loc

        Parameters:
            text     - {String} The string to localise.
            var_args - {...(String|Number)} The arguments to interpolate.

        Returns:
            {String} The localised string.
    */
    localise: function ( text ) {
        if ( arguments.length === 1 ) {
            var translation = active.translations[ text ];
            return translation !== undefined ? translation : text;
        } else {
            return active.translate.apply( active, arguments );
        }
    },

    /**
        Function: O.LocaleController.date

        Get a date or time formatted according to local conventions.

        Parameters:
            date - {...(String|Number|Object)} The arguments to interpolate.
            type - {String} The type of result you want, e.g. 'shortDate',
                   'time', 'fullDateAndTime'.

        Returns:
            {String} The localised date.
    */
    date: function ( date, type ) {
        return active.getFormattedDate( date, type );
    },

    /**
        Function: O.LocaleController.number

        Format a number according to local conventions. Ensures the correct
        symbol is used for a decimal point, and inserts thousands separators if
        used in the locale.

        Parameters:
            n - {(Number|String)} The number to format.

        Returns:
            {String} The localised number.
    */
    number: function ( n ) {
        var parts = ( n + '' ).split( '.' );
        parts[0] = parts[0].replace( /(\d+?)(?=(?:\d{3})+$)/g,
            '$1' + active.thousandsSeparator );
        return parts.join( active.decimalPoint );
    }
};

NS.LocaleController = NS.i18n = LocaleController;
NS.loc = LocaleController.localise;

}( this.O ) );

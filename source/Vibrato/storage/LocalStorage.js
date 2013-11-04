// -------------------------------------------------------------------------- \\
// File: LocalStorage.js                                                      \\
// Module: Storage                                                            \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

/*global location, sessionStorage, localStorage */

"use strict";

( function ( NS, undefined ) {

/**
    Module: Storage

    The Storage module provides classes for persistant storage in the client.
*/

var dummyStorage = {
    setItem: function () {},
    getItem: function () {}
};

/**
    Class: O.LocalStorage

    Extends: O.Object

    LocalStorage provides an observable object interface to the local/session
    storage facilities provided by modern browsers. Essentially, you can treat
    it as an instance of <O.Object> whose values persists between page reloads
    (and between browser sessions if not set to session-only).

    Since data is serialised to a string for storage, only native JS types
    should be stored; class instances will not be restored correctly.
*/
var LocalStorage = NS.Class({

    Extends: NS.Object,

    /**
        Constructor: O.LocalStorage

        Parameters:
            name        - {String} The name of this storage set. Objects with
                          the same name will overwrite each others' values.
            sessionOnly - {Boolean} (optional) Should the values only be
                          persisted for the session?
    */
    init: function ( name, sessionOnly ) {
        this._name = name + '.';
        this._store = location.protocol === 'file:' ? dummyStorage :
            sessionOnly ? sessionStorage : localStorage;

        LocalStorage.parent.init.call( this );
    },

    get: function ( key ) {
        if ( !( key in this ) ) {
            var item;
            // Firefox sometimes throws and error
            try {
                item = this._store.getItem( this._name + key );
            } catch ( error ) {}
            return item ? ( this[ key ] = JSON.parse( item ) ) : undefined;
        }
        return LocalStorage.parent.get.call( this, key );
    },

    set: function ( key, value ) {
        // If we exceed the storage quota, an error will be thrown.
        try {
            this._store.setItem( this._name + key, JSON.stringify( value ) );
        } catch ( error ) {}
        return LocalStorage.parent.set.call( this, key, value );
    }
});

NS.LocalStorage = LocalStorage;

}( this.O ) );

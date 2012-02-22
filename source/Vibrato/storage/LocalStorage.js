// -------------------------------------------------------------------------- \\
// File: LocalStorage.js                                                      \\
// Module: Storage                                                            \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, window */

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
*/
var LocalStorage = NS.Class({
    
    Extends: NS.Object,
    
    /**
        Constructor: O.LocalStorage

        Parameters:
            name        - {String} The name of this storage set. Objects with
                          the same name will overwrite each others' values.
            sessionOnly - {Boolean} Should the values only be persisted for the
                          session?
    */
    init: function ( name, sessionOnly ) {
        LocalStorage.parent.init.call( this );
        this._name = name + '.';
        this._store = window.location.protocol === 'file:' ? dummyStorage :
            sessionOnly ? window.sessionStorage : window.localStorage;
    },
    
    set: function ( key, value ) {
        // If we exceed the storage quota, an error will be thrown.
        try {
            this._store.setItem( this._name + key, JSON.stringify( value ) );
        } catch ( e ) {}
        LocalStorage.parent.set.call( this, key, value );
    },
    
    getUnknownProperty: function ( key ) {
        var item = this._store.getItem( this._name + key );
        return item ? ( this[ key ] = JSON.parse( item ) ) : this[ key ];
    }
});

NS.LocalStorage = LocalStorage;
	
}( O ) );
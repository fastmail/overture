// -------------------------------------------------------------------------- \\
// File: MemoryManager.js                                                     \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Store.js                                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {
    
/*
    Class: O.MemoryManager
    
    A MemoryManager instance periodically checks the store to ensure it doesn't
    have beyond a certain number of records in memory. If it does, the least
    recently used records are removed until the limit has no longer been
    breached.
*/

var MemoryManager = NS.Class({
    
    /*
        Property (private): O.MemoryManager#_typeIndex
        Type: Number
        
        Keeps track of which record type we need to examine next.
    */
    _typeIndex: 0,
    
    /*
        Property (private): O.MemoryManager#_types
        Type: Array<O.Class.<Record>>

        The name of each type we need to memory manage.
    */
     
    /*
        Property (private): O.MemoryManager#_store
        Type: O.Store
        
        The store where the records are stored.
    */
     
    /*
        Property (private): O.MemoryManager#_restrictions
        Type: Object
        
        An object mapping Record type name to its restrictions. A restrictions
        object may have a 'max' property and an 'afterCleanup' method.
    */
    
    /*
        Property: O.MemoryManager#frequency
        Type: Number
        Default: 30000 (30 seconds)
        
        The time in milliseconds between running the cleanup function.
    */
    
    /*
        Constructor: O.MemoryManager
        
        Parameters:
            store        - {Store} The store to be memory managed.
            restrictions - {Object} An object mapping each Record type name to
                           be managed to another object containing its
                           restrictions. This must have a max (number of
                           records) property and may have an afterCleanup
                           function, which will be given an array of removed
                           records every time some are removed from the store.
            frequency    - {Number} (optional) How frequently the cleanup
                           function is called in milliseconds. Default is 30000,
                           i.e. every 30 seconds.
    */
    init: function ( store, restrictions, frequency ) {
        this._store = store;
        this._restrictions = restrictions;
        this._types = Object.keys( restrictions );
        
        this.frequency = frequency || 30000;
        
        NS.RunLoop.invokeAfterDelay( this.cleanup, this.frequency, this );
    },
    
    /*
        Method: O.MemoryManager#cleanup
        
        Examines the store to see how many entries of each record type are
        present and removes references to the least recently accessed records
        until the number is under the set limit for that type. This is
        automatically called periodically by the memory manager.
    */
    cleanup: function () {
        var typeIndex = this._typeIndex,
            type = this._types[ typeIndex ],
            restrictions = this._restrictions[ type ],
            store = this._store,
            _skToLastAccess = store._skToLastAccess,
            _skToData = store._skToData,
            storeKeys = Object.keys( store._typeToSkToId[ type ] || {} ),
            count = storeKeys.length,
            numberToDelete = count - restrictions.max,
            afterFn = restrictions.afterCleanup,
            deleted = [],
            storeKey, data;
        
        storeKeys.sort( function ( a, b ) {
            return _skToLastAccess[b] - _skToLastAccess[a];
        });
        
        while ( numberToDelete > 0 && count-- ) {
            storeKey = storeKeys[ count ];
            data = _skToData[ storeKey ];
            if ( store.unloadRecord( storeKeys[ count ] ) ) {
                numberToDelete -= 1;
                if ( data ) { deleted.push( data ); }
            }
        }
        
        if ( afterFn ) { afterFn( deleted ); }
        
        this._typeIndex = typeIndex = ( typeIndex + 1 ) % this._types.length;
        
        // Yield between examining types so we don't hog the event queue.
        if ( typeIndex ) {
            NS.RunLoop.invokeInNextEventLoop( this.cleanup, this );
        } else {
            NS.RunLoop.invokeAfterDelay( this.cleanup, this.frequency, this );
        }
    }
});

NS.MemoryManager = MemoryManager;

}( O ) );
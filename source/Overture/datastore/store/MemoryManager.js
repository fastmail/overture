import { Class, guid } from '../../core/Core.js';
import RunLoop from '../../foundation/RunLoop.js';

import Record from '../record/Record.js';
import RemoteQuery from '../query/RemoteQuery.js';

/**
    Class: O.MemoryManager

    A MemoryManager instance periodically checks the store to ensure it doesn't
    have beyond a certain number of records in memory. If it does, the least
    recently used records are removed until the limit has no longer been
    breached.
*/

const MemoryManager = Class({

    /**
        Property (private): O.MemoryManager#_index
        Type: Number

        Keeps track of which record type we need to examine next.
    */

    /**
        Property (private): O.MemoryManager#_store
        Type: O.Store

        The store where the records are stored.
    */

    /**
        Property (private): O.MemoryManager#_restrictions
        Type: Array

        An array of objects, each containing the properties:
        - Type: The constructor for the Record or RemoteQuery subclass.
        - max: The maximum number allowed.
        - afterCleanup: An optional callback after cleanup, which will be given
          an array of removed objects of the given type, every time some are
          removed from the store.
    */

    /**
        Property: O.MemoryManager#frequency
        Type: Number
        Default: 30000 (30 seconds)

        The time in milliseconds between running the cleanup function.
    */

    /**
        Constructor: O.MemoryManager

        Parameters:
            store        - {Store} The store to be memory managed.
            restrictions - {Array} An array of objects, each containing the
                           properties:
                           * Type: The constructor for the Record or RemoteQuery
                             subclass.
                           * max: The maximum number allowed.
                           * afterCleanup: An optional callback after cleanup,
                             which will be given an array of removed objects of
                             the given type, every time some are removed from
                             the store.
            frequency    - {Number} (optional) How frequently the cleanup
                           function is called in milliseconds. Default is 30000,
                           i.e. every 30 seconds.
    */
    init: function ( store, restrictions, frequency ) {
        this._index = 0;
        this._store = store;
        this._restrictions = restrictions;

        this.isPaused = false;
        this.frequency = frequency || 30000;

        RunLoop.invokeAfterDelay( this.cleanup, this.frequency, this );
    },

    /**
        Method: O.MemoryManager#addRestriction

        Parameters:
            restriction - {Object} An object describing the restriction for a
                          type (see constructor for format).

        Adds a restriction for a new type after initialisation.

        Returns:
            {O.MemoryManager} Returns self.
    */
    addRestriction: function ( restriction ) {
        this._restrictions.push( restriction );
        return this;
    },

    /**
        Method: O.MemoryManager#cleanup

        Examines the store to see how many entries of each record type are
        present and removes references to the least recently accessed records
        until the number is under the set limit for that type. This is
        automatically called periodically by the memory manager.
    */
    cleanup: function () {
        let index = this._index;
        const restrictions = this._restrictions[ index ];
        const Type = restrictions.Type;
        let ParentType = Type;
        const max = restrictions.max;
        const afterFn = restrictions.afterCleanup;
        let deleted;

        if ( this.isPaused ) {
            RunLoop.invokeAfterDelay( this.cleanup, this.frequency, this );
            return;
        }

        do {
            if ( ParentType === Record ) {
                deleted = this.cleanupRecordType( Type, max );
                break;
            } else if ( ParentType === RemoteQuery ) {
                deleted = this.cleanupQueryType( Type, max );
                break;
            }
        } while ( ParentType = ParentType.parent.constructor );

        if ( afterFn ) { afterFn( deleted ); }

        this._index = index = ( index + 1 ) % this._restrictions.length;

        // Yield between examining types so we don't hog the event queue.
        if ( index ) {
            RunLoop.invokeInNextEventLoop( this.cleanup, this );
        } else {
            RunLoop.invokeAfterDelay( this.cleanup, this.frequency, this );
        }
    },

    /**
        Method: O.MemoryManager#cleanupRecordType

        Parameters:
            Type - {O.Class} The record type.
            max  - {Number} The maximum number allowed.

        Removes excess records from the store.
    */
    cleanupRecordType: function ( Type, max ) {
        const store = this._store;
        const _skToLastAccess = store._skToLastAccess;
        const _skToData = store._skToData;
        const storeKeys =
            Object.keys( store._typeToSkToId[ guid( Type ) ] || {} );
        let l = storeKeys.length;
        let numberToDelete = l - max;
        const deleted = [];

        storeKeys.sort( function ( a, b ) {
            return _skToLastAccess[b] - _skToLastAccess[a];
        });

        while ( numberToDelete > 0 && l-- ) {
            const storeKey = storeKeys[l];
            const data = _skToData[ storeKey ];
            if ( store.unloadRecord( storeKey ) ) {
                numberToDelete -= 1;
                if ( data ) { deleted.push( data ); }
            }
        }
        return deleted;
    },

    /**
        Method: O.MemoryManager#cleanupQueryType

        Parameters:
            Type - {O.Class} The query type.
            max  - {Number} The maximum number allowed.

        Removes excess remote queries from the store.
    */
    cleanupQueryType: function ( Type, max ) {
        const queries = this._store.getAllRemoteQueries()
                          .filter( function ( query ) {
                return query instanceof Type;
            });
        let l = queries.length;
        let numberToDelete = l - max;
        const deleted = [];

        queries.sort( function ( a, b ) {
            return b.lastAccess - a.lastAccess;
        });
        while ( numberToDelete > 0 && l-- ) {
            const query = queries[l];
            if ( !query.hasObservers() ) {
                query.destroy();
                deleted.push( query );
                numberToDelete -= 1;
            }
        }
        return deleted;
    },
});

export default MemoryManager;

import { Class, guid } from '../../core/Core';
import sortByProperties from '../../core/sortByProperties';
import Query from './Query';
import { EMPTY, READY, OBSOLETE } from '../record/Status';

/**
    Class: O.LocalQuery

    Extends: O.Query

    Includes: O.ObserverableRange, O.Enumerable

    A LocalQuery instance can be treated as an observable array which
    automatically updates its contents to reflect a certain query on the store.
    A query consists of a particular type, a filter function and a sort order.
    Normally you will not create a LocalQuery instance yourself but get it by
    retrieving the query from the store.
 */
const LocalQuery = Class({

    Extends: Query,

    autoRefresh: Query.AUTO_REFRESH_ALWAYS,

    /**
        Constructor: O.LocalQuery

        The following properties should be configured:

        store - {O.Store} The store to query for records.
        Type  - {O.Class} The constructor for the record type this query is a
                collection of.
        where - {Function} (optional) If supplied, only records which this
                function returns a truthy value for are included in the
                results.
        sort  - {(String|String[]|Function)} (optional) The records in
                the local query are sorted according to this named property. If
                an array is supplied, in the case of a tie the next property in
                the array will be consulted. If a function is supplied, this is
                used as the sort function directly on the records. If nothing
                is supplied, the results are not guaranteed to be in any
                particular order.

        Parameters:
            mixin - {Object} The properties for the query.
    */
    init ( mixin ) {
        const sort = mixin.sort;
        if ( sort && !( sort instanceof Function ) ) {
            mixin.sort = sortByProperties( sort );
        }
        LocalQuery.parent.constructor.apply( this, arguments );
    },

    monitorForChanges () {
        const typeId = guid( this.get( 'Type' ) );
        this.get( 'store' )
            .on( typeId, this, 'setObsolete' )
            .typeToStatus
                .addObserverForKey( typeId, this, 'typeStatusChanged' );
    },

    typeStatusChanged ( _, __, oldStatus, newStatus ) {
        if ( !( oldStatus & READY ) && ( newStatus & READY ) ) {
            this.setObsolete();
        }
    },

    unmonitorForChanges () {
        const typeId = guid( this.get( 'Type' ) );
        this.get( 'store' )
            .off( typeId, this, 'setObsolete' )
            .typeToStatus
                .removeObserverForKey( typeId, this, 'typeStatusChanged' );
    },

    fetch ( force, callback ) {
        const status = this.get( 'status' );

        if ( force || status === EMPTY || ( status & OBSOLETE ) ) {
            const Type = this.get( 'Type' );
            const store = this.get( 'store' );
            store.fetchAll( Type );
            if ( store.getTypeStatus( Type ) & READY ) {
                this.sourceWillFetchQuery();
                this.sourceDidFetchQuery(
                    store.findAll(
                        Type, this.get( 'where' ), this.get( 'sort' ) ),
                    store.getTypeState( Type )
                );
            }
        }

        if ( callback ) {
            callback();
        }

        return this;
    },
});

export default LocalQuery;

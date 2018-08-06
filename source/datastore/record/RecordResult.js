import { Class } from '../../core/Core';
import { EMPTY, NEW, DIRTY, COMMITTING, NON_EXISTENT } from './Status';
import Record from './Record';

// ---

const HANDLE_ALL_ERRORS = [];
const HANDLE_NO_ERRORS = [];

/**

    This class allows you to observe the result of fetching or committing a
    record.

    Usage (demonstrating the simpler form):

        record
            .set( … )  // Or anything that makes it commit changes.
            .ifSuccess({
                handledErrorTypes: [ 'somethingWrong' ],
            })
            .then( result => {
                if ( result.error ) {
                    // Do something with the somethingWrong error
                }
            });

    Or loading a record that may or may not exist:

        store
            .getRecord( null, Foo, 'id' )
            .ifSuccess()
                .then( function () {
                    // record loaded
                })
                .catch( function () {
                    // record didn't load
                })

    The object waits for the record to transition into a READY, DESTROYED or
    NON_EXISTENT state, then resolves.

    Note that when errors occur, the promise is still *resolved* with the
    RecordResult, rather than being rejected; this is because the place this
    class was designed for needs to handle the commit results of many records,
    and `Promise.all` will reject when the first one fails.

    When an error is “caught” (that is, error propagation is stopped), the
    changes in the store are not reverted.
*/
const RecordResult = Class({

    /**
        Property: O.RecordResult#error
        Type: {O.Event|null}

        Set for any commit error that occurs (whether a handled error or not).
    */

    /**
        Property: O.RecordResult#record
        Type: {O.Record}

        The record being observed
    */

    init ( record, resolve, mixin ) {
        this._resolve = resolve;

        this.record = record;
        this.error = null;

        record
            .on( 'record:commit:error', this, 'onError' )
            .addObserverForKey( 'status', this, 'statusDidChange' );

        Object.assign( this, mixin );
        this.statusDidChange( record, 'status', 0, record.get( 'status' ) );
    },

    done () {
        this.record
            .removeObserverForKey( 'status', this, 'statusDidChange' )
            .off( 'record:commit:error', this, 'onError' );
        this._resolve( this );
    },

    statusDidChange ( record, key, _, newStatus ) {
        if ( !( newStatus & (EMPTY|NEW|DIRTY|COMMITTING) ) ) {
            this.done();
        }
    },

    onError ( event ) {
        this.error = event;
        if ( this.shouldStopErrorPropagation( event ) ) {
            event.stopPropagation();
        }
        this.done();
    },

    /**
        Property: O.RecordResult#handledErrorTypes
        Type: {Array<string>|HANDLE_NO_ERRORS|HANDLE_ALL_ERRORS}
        Default: HANDLE_NO_ERRORS

        Either one of the two constants (available on the RecordResult
        constructor), or an array of error types to handle, e.g.
        `[ 'alreadyExists' ]`. (Where “handle” means “stop propagation on”.)
    */
    handledErrorTypes: HANDLE_NO_ERRORS,

     /**
        Method: O.RecordResult#shouldStopErrorPropagation

        Parameters:
            event - {O.Event} The commit error object.

        When an error occurs, should its propagation be stopped? If propagation
        is stopped, the changes will not be reverted in the store, and the
        crafter of the RecordResult is responsible for resolving the state in
        the store.

        Instances should normally be able to set `handledErrorTypes`, but if
        more complex requirements come up this method can also be overridden.

        Returns:
            {Boolean} Stop propagation of the event?
    */
    shouldStopErrorPropagation ( event ) {
        const handledErrorTypes = this.handledErrorTypes;
        return handledErrorTypes !== HANDLE_NO_ERRORS &&
            ( handledErrorTypes === HANDLE_ALL_ERRORS ||
                handledErrorTypes.indexOf( event.type ) !== -1 );
    },
});
RecordResult.HANDLE_ALL_ERRORS = HANDLE_ALL_ERRORS;
RecordResult.HANDLE_NO_ERRORS = HANDLE_NO_ERRORS;

// ---

Object.assign( Record.prototype, {
    getResult ( mixin ) {
        return new Promise( resolve =>
            new RecordResult( this, resolve, mixin )
        );
    },
    ifSuccess ( mixin ) {
        return new Promise( ( resolve, reject ) =>
            new RecordResult( this, function ( result ) {
                const record = result.record;
                if ( result.error || record.is( NON_EXISTENT ) ) {
                    reject( record );
                } else {
                    resolve( record );
                }
            }, mixin )
        );
    },
});

// --- Export

export default RecordResult;

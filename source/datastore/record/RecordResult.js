import { Class } from '../../core/Core';
import { EMPTY, NEW, DIRTY, COMMITTING, NON_EXISTENT } from './Status';
import Record from './Record';

// ---

const HANDLE_ALL_ERRORS = Symbol( 'HANDLE_ALL_ERRORS' );
const HANDLE_NO_ERRORS = [];

/**
    Class: O.RecordResult

    This class allows you to observe the result of fetching or committing a
    record.

    This class if used directly deals in callbacks; you should probably only
    ever instantiate it via <O.Record#ifSuccess> or <O.Record#getResult> which
    provide Promise interfaces. See those two functions for usage examples.

    The object waits for the record to transition into a READY, DESTROYED or
    NON_EXISTENT state, then calls the callback.

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

    init: function ( record, callback, mixin ) {
        this._callback = callback;

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
        this._callback( this );
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

        When an error occurs, should its propagation be stopped? If propagation
        is stopped, the changes will not be reverted in the store, and the
        crafter of the RecordResult is responsible for resolving the state in
        the store.

        Instances should normally be able to set `handledErrorTypes`, but if
        more complex requirements come up this method can also be overridden.

        Parameters:
            event - {O.Event} The commit error object.

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
    /*
        Function: O.Record#getResult
        Returns: {Promise<O.RecordResult>}

        The promise it returns will resolve to a RecordResult which has two
        notable properties, `record` and `error`.

        Normally, <O.Record#ifSuccess> will be easier to use, but if you’re
        working with batch processing of objects and Promise.all(), then you’ll
        want to use getResult rather than ifSuccess, because Promise.all() will
        reject with the first error it receives, whereas in such a situation
        you’ll want instead to produce an array of errors.

        Usage:

            record
                .set( … )  // Or anything that makes it commit changes.
                .getResult({
                    handledErrorTypes: [ 'somethingWrong' ],
                })
                .then( result => {
                    if ( result.error ) {
                        // Do something with the somethingWrong error
                    }
                });
    */
    getResult ( mixin ) {
        return new Promise( resolve =>
            new RecordResult( this, resolve, mixin )
        );
    },

    /*
        Function: O.Record#ifSuccess
        Returns: {Promise<O.Record, O.RecordResult>}

        The promise it returns will either resolve to the record, or be rejected
        with a RecordResult, which is an object containing two properties to
        care about, `record` and `error`.

        (Why the name ifSuccess? Read it as “set this field; if success, then do
        such-and-such, otherwise catch so-and-so.)

        Usage for catching failed commits:

            record
                .set( … )  // Or anything that makes it commit changes.
                .ifSuccess({
                    handledErrorTypes: [ 'somethingWrong' ],
                })
                .then( record => {
                    // Do something after the commit has finished
                })
                .catch( ({ record, error }) => {
                    // Do something with the somethingWrong error
                });

        Or for loading a record that may or may not exist:

            store
                .getRecord( null, Foo, 'id' )
                .ifSuccess()
                    .then( record => {
                        // record loaded
                    })
                    .catch( ({ record }) => {
                        // record didn't load
                    })

    */
    ifSuccess ( mixin ) {
        return new Promise( ( resolve, reject ) =>
            new RecordResult( this, result => {
                const record = result.record;
                if ( result.error || record.is( NON_EXISTENT ) ) {
                    reject( result );
                } else {
                    resolve( record );
                }
            }, mixin )
        );
    },
});

// --- Export

export default RecordResult;

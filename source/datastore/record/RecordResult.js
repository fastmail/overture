import { EMPTY, NEW, DIRTY, COMMITTING } from './Status.js';

// ---

const HANDLE_ALL_ERRORS = Symbol('HANDLE_ALL_ERRORS');
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
class RecordResult {
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

    constructor(record, callback, mixin) {
        this._callback = callback;

        this.record = record;
        this.error = null;

        record
            .on('record:commit:error', this, 'onError')
            .addObserverForKey('status', this, 'statusDidChange');

        Object.assign(this, mixin);
        this.statusDidChange(record, 'status', 0, record.get('status'));
    }

    done() {
        this.record
            .removeObserverForKey('status', this, 'statusDidChange')
            .off('record:commit:error', this, 'onError');
        this._callback(this);
    }

    statusDidChange(record, key, _, newStatus) {
        if (!(newStatus & (EMPTY | NEW | DIRTY | COMMITTING))) {
            this.done();
        }
    }

    onError(event) {
        this.error = event;
        if (this.shouldStopErrorPropagation(event)) {
            event.stopPropagation();
        }
        this.done();
    }

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
    shouldStopErrorPropagation(event) {
        const handledErrorTypes = this.handledErrorTypes;
        return (
            handledErrorTypes !== HANDLE_NO_ERRORS &&
            (handledErrorTypes === HANDLE_ALL_ERRORS ||
                handledErrorTypes.indexOf(event.type) !== -1)
        );
    }
}

/**
    Property: O.RecordResult#handledErrorTypes
    Type: {Array<string>|HANDLE_NO_ERRORS|HANDLE_ALL_ERRORS}
    Default: HANDLE_NO_ERRORS

    Either one of the two constants (available on the RecordResult
    constructor), or an array of error types to handle, e.g.
    `[ 'alreadyExists' ]`. (Where “handle” means “stop propagation on”.)
*/
RecordResult.prototype.handledErrorTypes = HANDLE_NO_ERRORS;

// --- Export

export { RecordResult, HANDLE_ALL_ERRORS, HANDLE_NO_ERRORS };

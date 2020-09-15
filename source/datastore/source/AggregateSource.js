import { Class } from '../../core/Core.js';
import '../../core/Array.js'; // For Array#erase
import /* { observes } from */ '../../foundation/Decorators.js';

import Source from './Source.js';

/**
    Class: O.AggregateSource

    An O.AggregateSource instance can be used to collect several <O.Source>
    instances together to present to an instance of <O.Store>. Each method call
    on an aggregate source is passed around the sources it is managing until it
    finds one that can handle it.
*/
const AggregateSource = Class({
    Extends: Source,

    init: function (/* ...mixins */) {
        this.sources = [];
        AggregateSource.parent.constructor.apply(this, arguments);
    },

    /**
        Property: O.AggregateSource#sources
        Type: O.Source[]

        List of sources to pass requests to. Will be tried in order.
    */

    /**
        Method: O.AggregateSource#addSource

        Parameters:
            source - {O.Source} The source to add to the end of the list of
                     aggregated sources.

        Returns:
            {O.AggregateSource} Returns self.
    */
    addSource(source) {
        source.set('store', this.get('store'));
        this.get('sources').push(source);
        return this;
    },

    /**
        Method: O.AggregateSource#removeSource

        Parameters:
            source - {O.Source} The source to remove from the list of aggregated
                     sources.

        Returns:
            {O.AggregateSource} Returns self.
    */
    removeSource(source) {
        this.get('sources').erase(source);
        return this;
    },

    storeWasSet: function () {
        const store = this.get('store');
        this.sources.forEach((source) => {
            source.set('store', store);
        });
    }.observes('store'),

    fetchRecord(accountId, Type, id, callback) {
        return this.get('sources').some((source) => {
            return source.fetchRecord(accountId, Type, id, callback);
        });
    },

    fetchAllRecords(accountId, Type, state, callback) {
        return this.get('sources').some((source) => {
            return source.fetchAllRecords(accountId, Type, state, callback);
        });
    },

    refreshRecord(accountId, Type, id, callback) {
        return this.get('sources').some((source) => {
            return source.refreshRecord(accountId, Type, id, callback);
        });
    },

    commitChanges(changes, callback) {
        let waiting = 0;
        let callbackAfterAll;
        if (callback) {
            callbackAfterAll = function () {
                if (!(waiting -= 1)) {
                    callback();
                }
            };
        }
        this.get('sources').forEach((source) => {
            if (source.commitChanges(changes, callbackAfterAll)) {
                waiting += 1;
            }
        });
        return this;
    },

    fetchQuery(query, callback) {
        return this.get('sources').some((source) => {
            return source.fetchQuery(query, callback);
        });
    },
});

export default AggregateSource;

import { Class } from '../core/Core.js';
import { Obj } from '../foundation/Object.js';

import '../core/Array.js'; // For Array#erase
import /* { on } from */ '../foundation/Decorators.js';

/**
    Module: IO

    The IO module provides classes for two-way communication with a server.
*/

/**
    Class: O.IOQueue

    Extends: O.Object

    Manage concurrent HTTP requests.
*/

const QUEUE = 1;
const IGNORE = 2;
const ABORT = 3;

const IOQueue = Class({
    Name: 'IOQueue',

    Extends: Obj,

    /**
        Property (private): O.IOQueue#_queue
        Type: Array

        Queue of request objects waiting for current transactions to finish.
    */

    /**
        Property: O.IOQueue#_recent
        Type: (O.HttpRequest|null)

        A reference to the most recent request.
    */

    /**
        Property: O.IOQueue#activeConnections
        Type: Number

        The number of active connections
    */

    /**
        Property: O.IOQueue#link
        Type: Number
        Default: O.IOQueue.QUEUE

        The property is used to determine what to do if a request is made and
        there are already the maximum allowed number of connections. Accepted
        values are the constants IOQueue.QUEUE, IOQueue.IGNORE and
        IOQueue.ABORT.

        * QUEUE: adds the request to a queue and then waits for the next active
          connection to finish before dispatching the oldest waiting request
          and so on until the queue is empty.
        * IGNORE: ignores the request if there are no free connections.
        * ABORT: aborts the most recent active request and immediately
          dispatches the new request.
    */
    link: QUEUE,

    /**
        Property: O.IOQueue#maxConnections
        Type: Number
        Default: 1

        The maximum number of concurrent connections to make with this IOQueue
        object. Note, this is a per-instance value; each IOQueue instance may
        make up to maxConnections to the server as defined on that object.
    */
    maxConnections: 1,

    /**
        Constructor: O.IOQueue

        Parameters:
            ...mixins - {Object} An object containing new defaults for any of
                        the public properties defined on the object. Can also
                        contain methods to override the normal methods to create
                        an anonymous subclass.
    */
    init: function (/* ...mixins */) {
        this._queue = [];
        this._recent = null;
        this.activeConnections = 0;

        IOQueue.parent.constructor.apply(this, arguments);
    },

    /**
        Method: O.IOQueue#send

        If the number of active requests is equal to the maximum allowed number
        of concurrent connections, the request will be queued, ignored or cause
        the most recent active request to abort as specified in the
        <O.IOQueue#link> property.

        Parameters:
            request - {O.HttpRequest}

        Returns:
            {O.IOQueue} Returns self.
    */
    send(request) {
        if (this.get('activeConnections') >= this.get('maxConnections')) {
            switch (this.get('link')) {
                case QUEUE:
                    this._queue.push(request);
                /* falls through */
                case IGNORE:
                    return this;
                case ABORT:
                    this._recent.abort();
                    break;
                default:
                    throw new Error('Invalid O.IOQueue link type.');
            }
        }

        this.increment('activeConnections', 1);

        // If already set, presume it will bubble to us
        if (!request.get('nextEventTarget')) {
            request.set('nextEventTarget', this);
        }

        // Store reference in case we need to abort a request.
        this._recent = request.send();

        return this;
    },

    /**
        Method: O.IOQueue#abort

        Abort the request if it is currently running, or remove it from the
        waiting queue if it has not yet run.

        Parameters:
            request - {O.HttpRequest}

        Returns:
            {O.IOQueue} Returns self.
    */
    abort(request) {
        this._queue.erase(request);
        request.abort();
        return this;
    },

    /**
        Method (private): O.IOQueue#_complete

        Cleans up any state set by the IOQueue methods on the Transport object
        and starts the next request in the queue, if any.

        Parameters:
            transport - {Transport} The transport object.
    */
    _complete: function (event) {
        const request = event.target;
        if (this._recent === request) {
            this._recent = null;
        }
        if (request.get('nextEventTarget') === this) {
            request.set('nextEventTarget', null);
        }
        this.increment('activeConnections', -1);

        if (this._queue.length) {
            this.send(this._queue.shift());
        }
    }.on('io:end'),
});

export { IOQueue, QUEUE, IGNORE, ABORT };

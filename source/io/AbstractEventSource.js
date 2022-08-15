/*global setTimeout, clearTimeout, navigator, self */

class ServerSentEvent {
    constructor(target, type, data, origin, lastEventId) {
        this.target = target;
        this.type = type;
        this.data = data;
        this.origin = origin;
        this.lastEventId = lastEventId;
    }
}

// ---

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

const inert = () => {};

/**
    The EventSource constructor takes a configuration object. All properties
    other than "url" are optional. Options are:

    * url: String
        The URL to connect to for the event source.
    * headers: String[String]
        Extra header name:values to add to the fetch, e.g. Authorization
    * lastEventId: String
        A last event id to send on first connection to the event source.
    * inactivityTimeout: Number (in ms, default 6 minutes)
        If no bytes of data have been received within this timespan, the
        connection will be aborted and restarted.
    * onreadystatechange: (oldState: Number, newState: Number) => ()
        Callback fn. Gets old/new ready states whenever it changes. States are:
        CONNECTING: We are establishing a connection to the server, or waiting
            to do so.
        OPEN: We are connected to the server and receiving events.
        CLOSED: We are not connected or trying to connect to the server.
    * onevent: (event: ServerSentEvent) => ()
        Callback fn. Gets an event object whenever the server pushes an event
        to the client.
    * onerror: (status: Number) => ()
        Callback fn. Gets the HTTP status code we received that indicated a
        permanent failure, causing the connection to be closed (and we will not
        try to reconnect automatically).

    The EventSource is in the CLOSED state after construction. When ready to
    receive events from the server, call #open(). If you no longer wish to
    receive events, you can call #close() to teardown the connection and
    release all resources.
*/
class AbstractEventSource {
    constructor(options) {
        this.url = '';
        this.headers = null;
        this.lastEventId = '';
        this.inactivityTimeout = 360000;

        this.onreadystatechange = inert;
        this.onevent = inert;
        this.onerror = inert;

        Object.assign(this, options);

        this._readyState = CLOSED;

        this._minReconnectDelay = 0;
        this._reconnectAfter = 0;
        this._reconnectTimeout = null;

        this._abortController = null;
        this._abortTimeout = null;
        this._nextTimeout = 0;
        this._lastEventId = '';
        this._eventName = '';
        this._data = '';
        this._origin = '';
    }

    get readyState() {
        return this._readyState;
    }

    set readyState(newReadyState) {
        const oldReadyState = this._readyState;
        if (oldReadyState !== newReadyState) {
            this._readyState = newReadyState;
            this.onreadystatechange(oldReadyState, newReadyState);
        }
    }

    open() {
        if (this.readyState === CLOSED) {
            self.addEventListener('visibilitychange', this, false);
            if (typeof navigator.connection !== 'undefined') {
                navigator.connection.addEventListener('change', this, false);
            } else {
                self.addEventListener('online', this, false);
            }
            this._fetchStream();
        }
        return this;
    }

    close() {
        if (this.readyState !== CLOSED) {
            // XHR#readystatechange fires synchronously on abort,
            // so be sure to set ready state to CLOSED first.
            this.readyState = CLOSED;
            if (this._abortController) {
                this._abortController.abort();
                this._abortController = null;
            } else if (this._reconnectTimeout) {
                clearTimeout(this._reconnectTimeout);
                this._reconnectTimeout = null;
            }
            this._reconnectAfter = 0;
            self.removeEventListener('visibilitychange', this, false);
            if (typeof navigator.connection !== 'undefined') {
                navigator.connection.removeEventListener('change', this, false);
            } else {
                self.removeEventListener('online', this, false);
            }
        }
        return this;
    }

    // ---

    handleEvent(event) {
        const shouldRetryNetwork =
            event.type === 'visibilitychange'
                ? // We've awakened from sleep, the connection is probably dead.
                  this._nextTimeout < Date.now()
                : // We've changed networks, or come back online.
                  navigator.onLine;
        if (shouldRetryNetwork) {
            if (this.readyState === OPEN) {
                // We've changed networks, our TCP connection may be dead;
                // restart to be sure.
                this._abortController.abort();
            } else if (this._reconnectTimeout) {
                // Waiting to reconnect; try immediately as we may have network.
                clearTimeout(this._reconnectTimeout);
                this._fetchStream();
            }
        }
    }

    willFetchWithOptions(options) {
        if (this.headers) {
            Object.assign(options.headers, this.headers);
        }
        return options;
    }

    // ---

    _processLine(line) {
        if (/\S/.test(line)) {
            const colon = line.indexOf(':');
            // Line starts with colon -> ignore.
            if (!colon) {
                return;
            }
            let field = line;
            let value = '';
            // Line contains colon:
            if (colon > 0) {
                field = line.slice(0, colon);
                value = line.slice(
                    line.charAt(colon + 1) === ' ' ? colon + 2 : colon + 1,
                );
            }
            switch (field) {
                case 'event':
                    this._eventName = value;
                    break;
                case 'data':
                    this._data += value + '\u000a';
                    break;
                case 'id':
                    this._lastEventId = value;
                    break;
                case 'retry':
                    if (/^\d+$/.test(value)) {
                        this._minReconnectDelay = parseInt(value, 10);
                    }
                    break;
            }
        } else {
            // Blank line; dispatch event
            let data = this._data;
            if (data) {
                if (data.charAt(data.length - 1) === '\u000a') {
                    data = data.slice(0, -1);
                }
                const lastEventId = (this.lastEventId = this._lastEventId);
                const origin = this._origin;
                const event = new ServerSentEvent(
                    this,
                    this._eventName || 'message',
                    data,
                    origin,
                    lastEventId,
                );
                this.onevent(event);
            }
            this._eventName = '';
            this._data = '';
        }
    }

    _didStartFetch(abortController) {
        const headers = {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-store',
        };
        if (this.lastEventId) {
            headers['Last-Event-ID'] = this.lastEventId;
        }
        const options = this.willFetchWithOptions({
            headers,
            signal: abortController.signal,
            cache: 'no-store',
        });

        this._reconnectTimeout = null;
        this._abortController = abortController;
        this._lastEventId = '';
        this._eventName = '';
        this._data = '';

        this.readyState = CONNECTING;

        // We can't reliably detect a broken TCP stream except by checking
        // for missing pings.
        const abort = abortController.abort.bind(abortController);
        const resetTimeout = () => {
            clearTimeout(this._abortTimeout);
            const inactivityTimeout = this.inactivityTimeout;
            this._abortTimeout = setTimeout(abort, inactivityTimeout);
            this._nextTimeout = Date.now() + inactivityTimeout;
        };
        resetTimeout();

        return [options, resetTimeout];
    }

    _didFinishFetch(didNetworkError, status, response) {
        // Temp errors, retry with exponential backoff:
        // * Network issue
        // * Rate limit response (429)
        // * Server error (>=500)
        clearTimeout(this._abortTimeout);
        if (this.readyState === CLOSED) {
            // Nothing to do
        } else if (didNetworkError || status === 429 || status >= 500) {
            let reconnectAfter = this._reconnectAfter;
            if (!reconnectAfter) {
                // Add jitter to avoid flood of reconnections if server
                // drops connection to many clients at once
                reconnectAfter = Math.round(Math.random() * 3000);
            } else {
                // Exponential backoff, max 5 minutes.
                reconnectAfter = Math.min(2 * reconnectAfter, 300000);
            }
            this._reconnectAfter = reconnectAfter;
            this._reconnectTimeout = setTimeout(
                this._fetchStream.bind(this),
                // User server-instructed minimum delay if set.
                Math.max(reconnectAfter, this._minReconnectDelay),
            );
            this.readyState = CONNECTING;
        } else {
            this.close();
            this.onerror(status, response);
        }
    }
}

// ---

export { AbstractEventSource, CONNECTING, OPEN, CLOSED };

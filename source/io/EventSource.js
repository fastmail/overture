/*global EventSource */

import { Class, meta } from '../core/Core';
import '../core/Array'; // For Array#include
import Obj from '../foundation/Object';
import * as RunLoop from '../foundation/RunLoop'; // + Function#invokeInRunLoop
import '../foundation/EventTarget'; // For Function#on
import '../foundation/ObservableProps'; // For Function#observes
import XHR from './XHR';

const NativeEventSource = window.EventSource;

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/**
    Class: O.EventSource

    Extends: O.Object

    Subscribe to push events on the server using this wrapper around the W3C
    EventSource object: <http://dev.w3.org/html5/eventsource/>

    Events are sent using a text/event-stream content type; see the linked spec
    for details. The event source object will fire events as they arrive.
*/
const EventSource = NativeEventSource
    ? Class({
          Extends: Obj,

          /**
        Property: O.EventSource#readyState
        Type: Number

        A number describing the ready state of the event source, corresponding
        to those in the W3C spec:

        0 - CONNECTING
        1 - OPEN
        2 - CLOSED
    */

          /**
        Property: O.EventSource#url
        Type: String

        The url to connect to in order to receive events
    */
          url: '',

          /**
        Constructor: O.EventSource

        Parameters:
            ...mixins - {Object} (optional) Any properties in this object will
                        be added to the new O.EventSource instance before
                        initialisation (so you can pass it getter/setter
                        functions or observing methods).
    */
          init: function (/* ...mixins */) {
              this._then = 0;
              this._tick = null;

              this.readyState = CLOSED;

              EventSource.parent.constructor.apply(this, arguments);

              const eventTypes = ['open', 'message', 'error'];
              const observers = meta(this).observers;
              for (const type in observers) {
                  if (observers[type] && /^__event__/.test(type)) {
                      eventTypes.include(type.slice(9));
                  }
              }
              this._eventTypes = eventTypes;
          },

          on(type) {
              const types = this._eventTypes;
              const eventSource = this._eventSource;
              if (types.indexOf(type) === -1) {
                  types.push(type);
                  if (eventSource) {
                      eventSource.addEventListener(type, this, false);
                  }
              }
              EventSource.parent.on.apply(this, arguments);
          },

          handleEvent: function (event) {
              this.set('readyState', this._eventSource.readyState);
              this.fire(event.type, event);
          }.invokeInRunLoop(),

          /**
        Method (private): O.EventSource#_check

        Checks the computer hasn't been asleep. If it has, it restarts the
        connection.
    */
          _check() {
              const now = Date.now();
              if (now - this._then > 67500) {
                  this.fire('restart').close().open();
              } else {
                  this._then = now;
                  this._tick = RunLoop.invokeAfterDelay(
                      this._check,
                      60000,
                      this,
                  );
                  // Chrome occasionally closes the event source without firing
                  // an event. Resync readyState here to work around.
                  this.set('readyState', this._eventSource.readyState);
              }
          },
          /**
        Method (private): O.EventSource#_startStopCheck

        Sets up the timer to check if the computer has been asleep.
    */
          _startStopCheck: function () {
              const tick = this._tick;
              if (this.get('readyState') !== CLOSED) {
                  if (!tick) {
                      this._then = Date.now();
                      this._check();
                  }
              } else {
                  if (tick) {
                      RunLoop.cancel(tick);
                      this._tick = null;
                  }
              }
          }.observes('readyState'),

          /**
        Method: O.EventSource#open

        If there is no current connection to the event source server,
        establishes a new connection.

        Returns:
            {O.EventSource} Returns self.
    */
          open() {
              if (this.get('readyState') === CLOSED) {
                  const eventSource = new NativeEventSource(this.get('url'));
                  this._eventSource = eventSource;
                  this._eventTypes.forEach((type) =>
                      eventSource.addEventListener(type, this, false),
                  );
                  this.set('readyState', eventSource.readyState);
              }
              return this;
          },

          /**
        Method: O.EventSource#close

        Close the connection to the event source server, if not already closed.

        Returns:
            {O.EventSource} Returns self.
    */
          close() {
              return this.set('readyState', CLOSED);
          },

          /**
        Method (private): O.EventSource#_sourceDidClose

        Removes event listeners and then the reference to an event source after
        it closes, as they cannot be reused.
    */
          _sourceDidClose: function () {
              if (this.get('readyState') === CLOSED) {
                  const eventSource = this._eventSource;
                  const types = this._eventTypes;
                  let l = types.length;
                  eventSource.close();
                  while (l--) {
                      eventSource.removeEventListener(types[l], this, false);
                  }
                  this._eventSource = null;
              }
          }.observes('readyState'),
      })
    : Class({
          Extends: Obj,

          readyState: CONNECTING,

          init: function (/* ...mixins */) {
              EventSource.parent.constructor.apply(this, arguments);
              this._xhr = new XHR(this);
          },

          open() {
              const headers = {
                  Accept: 'text/event-stream',
                  'Cache-Control': 'no-cache',
              };
              if (this._lastEventId) {
                  headers['Last-Event-ID'] = this._lastEventId;
              }

              this.set('readyState', CONNECTING);
              this._data = '';
              this._eventName = '';
              this._processedIndex = 0;
              this._lastNewLineIndex = 0;
              this._xhr.send('GET', this.get('url'), null, headers);
              return this;
          },

          close() {
              if (this.get('readyState') !== CLOSED) {
                  this._xhr.abort();
                  this.set('readyState', CLOSED);
              }
              return this;
          },

          _reconnectAfter: 30000,
          _lastEventId: '',

          // ---

          _dataDidArrive: function () {
              const xhr = this._xhr;
              // Must start with text/event-stream (i.e. indexOf must === 0)
              // If it doesn't, fail the connection.
              // IE doesn't let you read headers in the loading phase, so if we
              // don't know the response type, we'll just presume it's correct.
              const contentType = xhr.getHeader('Content-type');
              if (
                  contentType &&
                  contentType.indexOf('text/event-stream') !== 0
              ) {
                  this._failConnection();
              } else {
                  this._openConnection();
                  this._processData(xhr.getResponse());
              }
          }.on('io:loading'),

          _requestDidSucceed: function (event) {
              this._openConnection();
              this._processData(event.data + '\n\n');
              this._reconnect();
          }.on('io:success'),

          _requestDidFail: function () {
              this._failConnection();
          }.on('io:failure'),

          // ---

          _openConnection() {
              if (this.get('readyState') === CONNECTING) {
                  this.set('readyState', OPEN).fire('open');
              }
          },

          _failConnection() {
              this.close().fire('error');
          },

          _reconnect() {
              RunLoop.invokeAfterDelay(this.open, this._reconnectAfter, this);
          },

          _processData(text) {
              // Look for a new line character since the last processed
              let lastIndex = this._lastNewLineIndex;
              const newLine = /\r\n?|\n/g;

              // One leading U+FEFF BYTE ORDER MARK character must be ignored if
              // any are present.
              if (!lastIndex && text.charAt(0) === '\ufeff') {
                  lastIndex = 1;
              }
              newLine.lastIndex = this._processedIndex;
              let match;
              while ((match = newLine.exec(text))) {
                  this._processLine(text.slice(lastIndex, match.index));
                  lastIndex = newLine.lastIndex;
              }
              this._lastNewLineIndex = lastIndex;
              this._processedIndex = text.length;
          },

          _processLine(line) {
              // Blank line, dispatch event
              if (/^\s*$/.test(line)) {
                  this._dispatchEvent();
              } else {
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
                          line.charAt(colon + 1) === ' '
                              ? colon + 2
                              : colon + 1,
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
                              this._reconnectAfter = parseInt(value, 10);
                          }
                          break;
                  }
              }
          },

          _dispatchEvent() {
              let data = this._data;
              if (data) {
                  if (data.slice(-1) === '\u000a') {
                      data = data.slice(0, -1);
                  }
                  this.fire(this._eventName || 'message', {
                      data,
                      // origin: '',
                      lastEventId: this._lastEventId,
                  });
              }
              this._data = '';
              this._eventName = '';
          },
      });

/**
    Constant: O.EventSource.CONNECTING
    Type: Number

    <O.EventSource#readyState> when establishing a connection to the server.
*/
/**
    Constant: O.EventSource.OPEN
    Type: Number

    <O.EventSource#readyState> when a connection is open and receiving events.
*/
/**
    Constant: O.EventSource.CLOSED
    Type: Number

    <O.EventSource#readyState> when there is no connection and it is not being
    reestablished.
*/
EventSource.CONNECTING = CONNECTING;
EventSource.OPEN = OPEN;
EventSource.CLOSED = CLOSED;

export default EventSource;

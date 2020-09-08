import { Class } from '../core/Core.js';
import '../core/Date.js'; // For Date#format
import '../core/String.js'; // For String#escapeHTML
import Obj from '../foundation/Object.js';
import '../foundation/EventTarget.js'; // For Function#on
import * as RunLoop from '../foundation/RunLoop.js'; // + Function#invokeInRunLoop

/**
    Class: O.WindowController

    Extends: O.Object

    If your application is open in multiple browser windows/tabs, you may want
    to coordinate behaviour between them, but you can't get a direct reference
    to a window you didn't explicitly open. This class allows you to broadcast
    messages to other tabs open in the same domain, so you can still coordinate
    behaviour. In particular, if you use push events in your application, you
    probably want only one tab to actually hold a permanent connection to the
    push server. Browsers limit the maximum number of simultaneous connections
    to the same server, so if you have (say) 6 tabs open, all of the allowed
    connections could be taken up with push connections which are never
    released, so your application cannot perform any other I/O and will appear
    to mysteriously fail.

    The WindowController class automatically coordinates between windows to
    elect a single tab to be "master". You can connect just this one to your
    push server, then broadcast any push events received to the other tabs via
    this controller as well. It also monitors whether the window currently has
    focus or not.
*/
const WindowController = Class({
    Extends: Obj,

    /**
        Property: O.WindowController#broadcastKey
        Type: String
        Default: "owm:broadcast"

        The key to use for the local storage property that will be set to
        broadcast messages to other tabs.
    */
    broadcastKey: 'owm:broadcast',

    /**
        Property: O.WindowController#isMaster
        Type: Boolean

        Is this tab/window the elected "master"? If multiple windows with the
        application are open, they will coordinate between themselves so only
        one has the isMaster property set to true. Note, in some circumstances,
        this may not happen instantly and there may be a short while when there
        is no master or more than one master. However, it will quickly resolve
        itself.
    */

    /**
        Property: O.WindowController#isFocused
        Type: Boolean

        Is the tab/window currently focused?
    */

    /**
        Property: O.WindowController#id
        Type: String

        A unique id for the window, guaranteed to be different than for any
        other open window.
    */

    init: function (/* ...mixins */) {
        this.id = new Date().format('%y%m%d%H%M%S') + Math.random();
        this.isMaster = false;
        this.isFocused = document.hasFocus ? document.hasFocus() : true;

        this._seenWCs = {};
        this._checkTimeout = null;
        this._pingTimeout = null;

        WindowController.parent.constructor.apply(this, arguments);

        window.addEventListener('storage', this, false);
        window.addEventListener('unload', this, false);
        window.addEventListener('focus', this, false);
        window.addEventListener('blur', this, false);

        this.start();
    },

    destroy() {
        this.end(this.get('broadcastKey'));

        window.removeEventListener('storage', this, false);
        window.removeEventListener('unload', this, false);
        window.removeEventListener('focus', this, false);
        window.removeEventListener('blur', this, false);

        WindowController.parent.destroy.call(this);
    },

    start() {
        this.broadcast('wc:hello');

        const check = () => {
            this.checkMaster();
            this._checkTimeout = RunLoop.invokeAfterDelay(check, 9000);
        };
        const ping = () => {
            this.sendPing();
            this._pingTimeout = RunLoop.invokeAfterDelay(ping, 17000);
        };
        this._checkTimeout = RunLoop.invokeAfterDelay(check, 500);
        this._pingTimeout = RunLoop.invokeAfterDelay(ping, 17000);
    },

    end(broadcastKey) {
        RunLoop.cancel(this._pingTimeout);
        RunLoop.cancel(this._checkTimeout);

        this.broadcast('wc:bye', null, broadcastKey);
    },

    broadcastKeyDidChange: function (_, __, oldBroadcastKey) {
        this.end(oldBroadcastKey);
        this.start();
    }.observes('broadcastKey'),

    /**
        Method (protected): O.WindowController#handleEvent

        Handles storage, unload, focus and blur events.

        Parameters:
            event - {Event} The event object.
    */
    handleEvent: function (event) {
        switch (event.type) {
            case 'storage':
                if (event.key === this.get('broadcastKey')) {
                    try {
                        const data = JSON.parse(event.newValue);
                        // IE fires events in the same window that set the
                        // property. Ignore these.
                        if (data.wcId !== this.id) {
                            this.fire(data.type, data);
                        }
                    } catch (error) {}
                }
                break;
            case 'unload':
                this.destroy();
                break;
            case 'focus':
                this.set('isFocused', true);
                break;
            case 'blur':
                this.set('isFocused', false);
                break;
        }
    }.invokeInRunLoop(),

    /**
        Method (protected): O.WindowController#sendPing

        Sends a ping to let other windows know about the existence of this one.
        Automatically called periodically.
    */
    sendPing() {
        this.broadcast('wc:ping');
    },

    /**
        Method (private): O.WindowController#_hello

        Handles the arrival of a new window.

        Parameters:
            event - {Event} An event object containing the window id.
    */
    _hello: function (event) {
        this._ping(event);
        if (event.wcId < this.id) {
            this.checkMaster();
        } else {
            this.sendPing();
        }
    }.on('wc:hello'),

    /**
        Method (private): O.WindowController#_ping

        Handles a ping from another window.

        Parameters:
            event - {Event} An event object containing the window id.
    */
    _ping: function (event) {
        this._seenWCs[event.wcId] = Date.now();
    }.on('wc:ping'),

    /**
        Method (private): O.WindowController#_bye

        Handles the departure of another window.

        Parameters:
            event - {Event} An event object containing the window id.
    */
    _bye: function (event) {
        delete this._seenWCs[event.wcId];
        this.checkMaster();
    }.on('wc:bye'),

    /**
        Method: O.WindowController#checkMaster

        Looks at the set of other windows it knows about and sets the isMaster
        property based on whether this window has the lowest ordered id.
    */
    checkMaster() {
        const now = Date.now();
        let isMaster = true;
        const seenWCs = this._seenWCs;
        const ourId = this.id;
        for (const id in seenWCs) {
            if (seenWCs[id] + 23000 < now) {
                delete seenWCs[id];
            } else if (id < ourId) {
                isMaster = false;
            }
        }
        this.set('isMaster', isMaster);
    },

    /**
        Method: O.WindowController#broadcast

        Broadcast an event with JSON-serialisable data to other tabs.

        Parameters:
            type         - {String} The name of the event being broadcast.
            data         - {Object} (optional). The data to broadcast.
            broadcastKey - {String} (optional). The key to use; otherwise the
                           key will be taken from the broadcastKey property.
    */
    broadcast(type, data, broadcastKey) {
        try {
            localStorage.setItem(
                broadcastKey || this.get('broadcastKey'),
                JSON.stringify(
                    Object.assign(
                        {
                            wcId: this.id,
                            type,
                        },
                        data,
                    ),
                ),
            );
        } catch (error) {}
    },
});

export default WindowController;

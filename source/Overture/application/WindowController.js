/*global JSON, window, document, localStorage */

import { Class, extend } from '../core/Core.js';  // Also Function#extend
import '../core/Date.js';  // For Date#format
import '../core/String.js';  // For String#escapeHTML
import Object from '../foundation/Object.js';
import '../foundation/EventTarget.js';  // For Function#on
import RunLoop from '../foundation/RunLoop.js';  // + Function#invokeInRunLoop
import UA from '../ua/UA.js';

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

    The WindowController class automatically coordinates between windows to
    elect a single tab to be "master". You can connect just this one to your
    push server, then broadcast any push events received to the other tabs via
    this controller as well. It also monitors whether the window currently has
    focus or not.
*/
var WindowController = Class({

    Extends: Object,

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
        Property: O.WindowController#isFocussed
        Type: Boolean

        Is the tab/window currently focussed?
    */

    /**
        Property: O.WindowController#id
        Type: String

        A unique id for the window, guaranteed to be different than for any
        other open window.
    */

    init: function ( mixin ) {
        this.id = new Date().format( '%y%m%d%H%M%S' ) + Math.random();
        this.isMaster = false;
        this.isFocussed = document.hasFocus ? document.hasFocus() : true;
        this._seenWCs = {};

        WindowController.parent.init.call( this, mixin );

        window.addEventListener( 'storage', this, false );
        window.addEventListener( 'unload', this, false );
        window.addEventListener( 'focus', this, false );
        window.addEventListener( 'blur', this, false );

        this.broadcast( 'wc:hello' );

        var that = this;
        var check = function check () {
            that.checkMaster();
            that._checkTimeout = RunLoop.invokeAfterDelay( check, 9000 );
        };
        var ping = function ping () {
            that.sendPing();
            that._pingTimeout = RunLoop.invokeAfterDelay( ping, 17000 );
        };
        this._checkTimeout = RunLoop.invokeAfterDelay( check, 500 );
        this._pingTimeout = RunLoop.invokeAfterDelay( ping, 17000 );
    },

    destroy: function () {
        RunLoop.cancel( this._pingTimeout )
               .cancel( this._checkTimeout );

        window.removeEventListener( 'storage', this, false );
        window.removeEventListener( 'unload', this, false );
        window.removeEventListener( 'focus', this, false );
        window.removeEventListener( 'blur', this, false );

        this.broadcast( 'wc:bye' );

        WindowController.parent.destroy.call( this );
    },

    /**
        Method (protected): O.WindowController#handleEvent

        Handles storage, unload, focus and blur events.

        Parameters:
            event - {Event} The event object.
    */
    handleEvent: function ( event ) {
        switch( event.type ) {
        case 'storage':
            if ( event.key === this.get( 'broadcastKey' ) ) {
                try {
                    var data = JSON.parse( event.newValue );
                    // IE fires events in the same window that set the
                    // property. Ignore these.
                    if ( data.wcId !== this.id ) {
                        this.fire( data.type, data );
                    }
                } catch ( error ) {}
            }
            break;
        case 'unload':
            this.destroy();
            break;
        case 'focus':
            this.set( 'isFocussed', true );
            break;
        case 'blur':
            this.set( 'isFocussed', false );
            break;
        }
    }.invokeInRunLoop(),


    /**
        Method (protected): O.WindowController#sendPing

        Sends a ping to let other windows know about the existence of this one.
        Automatically called periodically.
    */
    sendPing: function () {
        this.broadcast( 'wc:ping' );
    },

    /**
        Method (private): O.WindowController#_hello

        Handles the arrival of a new window.

        Parameters:
            event - {Event} An event object containing the window id.
    */
    _hello: function ( event ) {
        this._ping( event );
        if ( event.wcId < this.id ) {
            this.checkMaster();
        } else {
            this.sendPing();
        }
    }.on( 'wc:hello' ),

    /**
        Method (private): O.WindowController#_ping

        Handles a ping from another window.

        Parameters:
            event - {Event} An event object containing the window id.
    */
    _ping: function ( event ) {
        this._seenWCs[ event.wcId ] = Date.now();
    }.on( 'wc:ping' ),


    /**
        Method (private): O.WindowController#_bye

        Handles the departure of another window.

        Parameters:
            event - {Event} An event object containing the window id.
    */
    _bye: function ( event ) {
        delete this._seenWCs[ event.wcId ];
        this.checkMaster();
    }.on( 'wc:bye' ),

    /**
        Method: O.WindowController#checkMaster

        Looks at the set of other windows it knows about and sets the isMaster
        property based on whether this window has the lowest ordered id.
    */
    checkMaster: function () {
        var now = Date.now(),
            isMaster = true,
            seenWCs = this._seenWCs,
            ourId = this.id,
            id;
        for ( id in seenWCs ) {
            if ( seenWCs[ id ] + 23000 < now ) {
                delete seenWCs[ id ];
            } else if ( id < ourId ) {
                isMaster = false;
            }
        }
        this.set( 'isMaster', isMaster );
    },

    /**
        Method: O.WindowController#broadcast

        Broadcast an event with JSON-serialisable data to other tabs.

        Parameters:
            type - {String} The name of the event being broadcast.
            data - {Object} (optional). The data to broadcast.
    */
    broadcast: function ( type, data ) {
        try {
            localStorage.setItem(
                this.get( 'broadcastKey' ),
                JSON.stringify( extend({
                    wcId: this.id,
                    type: type,
                }, data ))
            );
        } catch ( error ) {}
    },
}).extend({
    openExternal: function ( href ) {
        var newWindow = window.open( '', '_blank' );
        var htmlHref = href;
        if ( newWindow ) {
            // From goog.window.open; IE has trouble if there's a
            // semi-colon in the URL apparently.
            if ( UA.msie && href.indexOf( ';' ) > -1 ) {
                htmlHref = "'" + htmlHref.replace( /'/g, '%27' ) + "'";
            }
            htmlHref = htmlHref.escapeHTML().replace( /"/g, '&quot;' );
            try {
                newWindow.opener = null;
                newWindow.document.write(
                    '<META HTTP-EQUIV="refresh" content="0; url=' +
                        htmlHref +
                    '">'
                );
                newWindow.document.close();
            } catch ( error ) {
                newWindow.location.href = href;
            }
        }
        return newWindow;
    },
});

export default WindowController;

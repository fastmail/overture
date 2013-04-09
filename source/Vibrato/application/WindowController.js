// -------------------------------------------------------------------------- \\
// File: WindowController.js                                                  \\
// Module: Application                                                        \\
// Requires: Core, Foundation, UA                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, OperaMail, window, document, localStorage */

"use strict";

( function ( NS, window, document, localStorage ) {

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
var WindowController = NS.Class({

    Extends: NS.Object,

    /**
        Property: O.WindowController#pingKey
        Type: String
        Default: "owm:ping"

        The key to use for the local storage property that will be set
        periodically by the master tab to tell other tabs it is still alive.
    */
    pingKey: 'owm:ping',

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

    init: function ( mixin ) {
        this.isMaster = false;
        this.isFocussed = ( NS.UA.msie !== 8 && document.hasFocus ) ?
            document.hasFocus() : true;

        WindowController.parent.init.call( this, mixin );

        var now = Date.now(),
            pingKey = this.get( 'pingKey' ),
            masterLastSeen = 0;
        try {
            masterLastSeen = +localStorage.getItem( pingKey ) || 0;
        } catch ( error ) {}
        if ( now - masterLastSeen > 45000 ) {
            this.becomeMaster();
        } else {
            this.loseMaster();
        }

        window.addEventListener( 'storage', this, false );
        window.addEventListener( 'unload', this, false );
        window.addEventListener( 'focus', this, false );
        window.addEventListener( 'blur', this, false );
    },

    destroy: function () {
        if ( this.get( 'isMaster' ) ) {
            try {
                localStorage.setItem( this.get( 'pingKey' ), 0 );
            } catch ( error ) {}
        }

        window.removeEventListener( 'storage', this, false );
        window.removeEventListener( 'unload', this, false );

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
            var type = event.key,
                masterLastSeen = 0,
                pingKey = this.get( 'pingKey' ),
                broadcastKey = this.get( 'broadcastKey' ),
                data;
            if ( type === pingKey ) {
                try {
                    masterLastSeen = +localStorage.getItem( pingKey ) || 0;
                } catch ( error ) {}
                if ( masterLastSeen ) {
                    this.loseMaster();
                } else {
                    // We add a random delay to try avoid the race condition in
                    // Chrome, which doesn't take out a mutex on local storage.
                    // It's imperfect, but will eventually work out.
                    NS.RunLoop.cancel( this._ping );
                    this._ping = NS.RunLoop.invokeAfterDelay(
                        this.becomeMaster, ~~( Math.random() * 1000 ), this );
                }
            } else if ( type === broadcastKey ) {
                try {
                    data = JSON.parse(
                        localStorage.getItem( broadcastKey )
                    );
                    this.fire( data.type, data );
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
        Method: O.WindowController#becomeMaster

        Force this tab/window to become the master tab if it is not already (and
        force the current master tab to lose its master status).
    */
    becomeMaster: function () {
        try {
            localStorage.setItem( this.get( 'pingKey' ), Date.now() );
        } catch ( error ) {}
        this.set( 'isMaster', true );
        NS.RunLoop.cancel( this._ping );
        this._ping = NS.RunLoop.invokeAfterDelay(
            this.becomeMaster, 20000 + ~~( Math.random() * 10000 ), this );
    },

    /**
        Method: O.WindowController#loseMaster

        Resign status as the master tab; another open tab will take over soon
        after. Note, if no other tab is open, this one will take back master
        status after a delay.
    */
    loseMaster: function () {
        this.set( 'isMaster', false );
        NS.RunLoop.cancel( this._ping );
        this._ping = NS.RunLoop.invokeAfterDelay(
            this.becomeMaster, 35000 + ~~( Math.random() * 20000 ), this );
    },

    /**
        Method: O.WindowController#broadcast

        Broadcast a JSON-serialisable object to other tabs. The object MUST
        contain a `type` property with the name of the event to be fired on the
        window controller instance in other windows

        Parameters:
            data - {Object} The data to broadcast. Must include a `type`
                   property.
    */
    broadcast: function ( data ) {
        try {
            localStorage.setItem(
                this.get( 'broadcastKey' ),
                JSON.stringify( data )
            );
        } catch ( error ) {}
    }
});

NS.WindowController = WindowController;

}( this.O, window, document, localStorage ) );

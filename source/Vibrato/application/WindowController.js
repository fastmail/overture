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

var WindowController = NS.Class({

    Extends: NS.Object,

    isMaster: false,
    isFocussed: NS.UA.msie !== 8 && document.hasFocus ?
        document.hasFocus() : true,

    broadcastKey: 'owm:broadcast',
    pingKey: 'owm:ping',

    init: function ( options ) {
        WindowController.parent.init.call( this, options );
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
    becomeMaster: function () {
        try {
            localStorage.setItem( this.get( 'pingKey' ), Date.now() );
        } catch ( error ) {}
        this.set( 'isMaster', true );
        NS.RunLoop.cancel( this._ping );
        this._ping = NS.RunLoop.invokeAfterDelay(
            this.becomeMaster, 20000 + ~~( Math.random() * 10000 ), this );
    },
    loseMaster: function () {
        this.set( 'isMaster', false );
        NS.RunLoop.cancel( this._ping );
        this._ping = NS.RunLoop.invokeAfterDelay(
            this.becomeMaster, 35000 + ~~( Math.random() * 20000 ), this );
    },
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
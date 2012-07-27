// -------------------------------------------------------------------------- \\
// File: GlobalKeyboardShortcuts.js                                           \\
// Module: Application                                                        \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {
/**
    Class: O.GlobalKeyboardShortcuts

    Extends: O.Object

    This class facilitates adding keyboard shortcuts to your application.
*/
var GlobalKeyboardShortcuts = NS.Class({

    Extends: NS.Object,

    /**
        Property: O.GlobalKeyboardShortcuts#isEnabled
        Type: Boolean
        Default: true

        Callbacks will only fire if this property is true when the instance
        handles the event.
    */
    isEnabled: true,

    /**
        Property (private): O.GlobalKeyboardShortcuts#_shortcuts
        Type: Object

        The map of shortcut key to an array of `[object, method]` tuples.
    */

    /**
        Constructor: O.GlobalKeyboardShortcuts
    */
    init: function ( options ) {
        this._shortcuts = {};
        GlobalKeyboardShortcuts.parent.init.call( this, options );
        var RootViewController = NS.RootViewController;
        RootViewController.kbShortcuts = this;
        RootViewController.queueResponder( this );
    },

    /**
        Method: O.GlobalKeyboardShortcuts#destroy

        Destructor.
    */
    destroy: function () {
        var RootViewController = NS.RootViewController;
        if ( RootViewController.kbShortcuts === this ) {
            delete NS.RootViewController.kbShortcuts;
        }
        RootViewController.removeResponder( this );
        GlobalKeyboardShortcuts.parent.destroy.call( this );
    },

    /**
        Method: O.GlobalKeyboardShortcuts#register

        Add a global keyboard shortcut. If a shortcut has already been
        registered for this key, it will be replaced, but will be restored when
        the new handler is removed.

        Parameters:
            key    - {String} The key to trigger the callback on. Modifier keys
                     (alt, ctrl, meta, shift) should be prefixed in alphabetical
                     order and with a hypen after each one. Letters should be
                     lower case. e.g. `ctrl-f`.
            object - {Object} The object to trigger the callback on.
            method - {String} The name of the method to trigger.

        Returns:
            {O.GlobalKeyboardShortcuts} Returns self.
    */
    register: function ( key, object, method ) {
        var shortcuts = this._shortcuts;
        ( shortcuts[ key ] || ( shortcuts[ key ] = [] ) )
            .push([ object, method ]);
        return this;
    },

    /**
        Method: O.GlobalKeyboardShortcuts#deregister

        Remove a global keyboard shortcut. Must use identical arguments to those
        which were used in the call to <O.GlobalKeyboardShortcuts#register>.

        Parameters:
            key    - {String} The key on which the callback was triggered.
            object - {Object} The object on which the callback was triggered.
            method - {String} The name of the method that was being triggered.

        Returns:
            {O.GlobalKeyboardShortcuts} Returns self.
   */
    deregister: function ( key, object, method ) {
        var current = this._shortcuts[ key ],
            length = current ? current.length : 0,
            l = length,
            item;
        while ( l-- ) {
            item = current[l];
            if ( item[0] === object && item[1] === method ) {
                if ( length === 1 ) {
                    delete this._shortcuts[ key ];
                } else {
                    current.splice( l, 1 );
                }
            }
        }
        return this;
    },

    /**
        Method: O.GlobalKeyboardShortcuts#getHandlerForEvent

        Get the keyboard shortcut to be triggered by a key event.

        Parameters:
            event - {Event} The keypress event object.

        Returns:
            {Array|null} Returns the [ object, method ] tuple to be triggered by
            the event, or null if nothing is registered for this key press.
   */
    getHandlerForEvent: function ( event ) {
        var key = NS.DOMEvent.lookupKey( event ),
            shortcuts = this._shortcuts[ key ];
        if ( shortcuts && this.get( 'isEnabled' ) ) {
            return shortcuts[ shortcuts.length - 1 ];
        }
        return null;
    },

    /**
        Method (private): O.GlobalKeyboardShortcuts#_trigger

        Keypress event handler. Triggers any registered callback.

        Parameters:
            event - {DOMEvent} The keypress event.
   */
    _trigger: function ( event ) {
        var handler = this.getHandlerForEvent( event );
        if ( handler ) {
            handler[0][ handler[1] ]( event );
            event.preventDefault();
        }
    }.on( 'keypress' )
});

NS.GlobalKeyboardShortcuts = GlobalKeyboardShortcuts;

}( this.O ) );

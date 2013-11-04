// -------------------------------------------------------------------------- \\
// File: GlobalKeyboardShortcuts.js                                           \\
// Module: Application                                                        \\
// Requires: Core, Foundation, UA                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var isMac = NS.UA.isMac;
var platformKeys = {
    alt: isMac ? '⌥' : 'Alt-',
    cmd: isMac ? '⌘' : 'Ctrl-',
    meta: isMac ? '⌘' : 'Meta-',
    shift: isMac ? '⇧' : 'Shift-',
    enter: isMac ? '↵' : 'Enter',
    backspace: isMac ? '⌫' : 'Backspace'
};

/**
    Function: O.formatKeyForPlatform

    Parameters:
        shortcut - {String} The keyboard shorcut, in the same format as
                   taken by <O.GlobalKeyboardShortcuts#register>.

    Returns:
        {String} The shortcut formatted for display on the user's platform.
*/
NS.formatKeyForPlatform = function ( shortcut ) {
    return shortcut.split( '-' ).map( function ( key ) {
        return platformKeys[ key ] || key.capitalise();
    }).join( '' );
};

var allowedInputs = {
    checkbox: 1,
    radio: 1,
    file: 1,
    submit: 1
};

var handleOnDown = {};

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

    /**
        Property (private): O.GlobalKeyboardShortcuts#_shortcuts
        Type: Object

        The map of shortcut key to an array of `[object, method]` tuples.
    */

    /**
        Constructor: O.GlobalKeyboardShortcuts
    */
    init: function ( mixin ) {
        this.isEnabled = true;
        this._shortcuts = {};

        GlobalKeyboardShortcuts.parent.init.call( this, mixin );

        var ViewEventsController = NS.ViewEventsController;
        ViewEventsController.kbShortcuts = this;
        ViewEventsController.addEventTarget( this, -10 );
    },

    /**
        Method: O.GlobalKeyboardShortcuts#destroy

        Destructor.
    */
    destroy: function () {
        var ViewEventsController = NS.ViewEventsController;
        if ( ViewEventsController.kbShortcuts === this ) {
            delete NS.ViewEventsController.kbShortcuts;
        }
        ViewEventsController.removeEventTarget( this );
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

                     The special modifier "cmd-" may be used, which will map
                     to "meta-" on a Mac (the command key) and "Ctrl-"
                     elsewhere.
            object - {Object} The object to trigger the callback on.
            method - {String} The name of the method to trigger.

        Returns:
            {O.GlobalKeyboardShortcuts} Returns self.
    */
    register: function ( key, object, method ) {
        key = key.replace( 'cmd-', isMac ? 'meta-' : 'ctrl-' );
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
        key = key.replace( 'cmd-', isMac ? 'meta-' : 'ctrl-' );
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
        Method: O.GlobalKeyboardShortcuts#getHandlerForKey

        Get the keyboard shortcut to be triggered by a key combo, represented as
        a string, as output by <O.DOMEvent#lookupKey>.

        Parameters:
            key - {String} The key combo to get the handler for.

        Returns:
            {Array|null} Returns the [ object, method ] tuple to be triggered by
            the event, or null if nothing is registered for this key press.
   */
    getHandlerForKey: function ( key ) {
        var shortcuts = this._shortcuts[ key ];
        if ( shortcuts && this.get( 'isEnabled' ) ) {
            return shortcuts[ shortcuts.length - 1 ];
        }
        return null;
    },

    /**
        Method: O.GlobalKeyboardShortcuts#trigger

        Keypress event handler. Triggers any registered callback.

        Parameters:
            event - {DOMEvent} The keydown/keypress event.
   */
    trigger: function ( event ) {
        var target = event.target,
            nodeName = target.nodeName,
            isSpecialKey = event.ctrlKey || event.metaKey,
            handler, key;
        if ( !isSpecialKey && ( nodeName === 'TEXTAREA' ||
                ( nodeName === 'INPUT' && !allowedInputs[ target.type ] ) ||
                ( event.targetView instanceof NS.RichTextView )
             ) ) {
            return;
        }
        key = NS.DOMEvent.lookupKey( event );
        if ( event.type === 'keydown' ) {
            handleOnDown[ key ] = true;
        } else if ( handleOnDown[ key ] ) {
            return;
        }
        handler = this.getHandlerForKey( key );
        if ( handler ) {
            handler[0][ handler[1] ]( event );
            event.preventDefault();
        }
    }.on( 'keydown', 'keypress' )
});

NS.GlobalKeyboardShortcuts = GlobalKeyboardShortcuts;

}( this.O ) );

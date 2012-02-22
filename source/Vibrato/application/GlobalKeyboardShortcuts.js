// -------------------------------------------------------------------------- \\
// File: GlobalKeyboardShortcuts.js                                           \\
// Module: Application                                                        \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

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
        
        The map of shortcut key to `[object, method]` tuples.
    */
    _shortcuts: {},
    
    /**
        Constructor: O.GlobalKeyboardShortcuts
    */
    init: function () {
        NS.RootViewController.queueResponder( this );
    },

    /**
        Method: O.GlobalKeyboardShortcuts#destroy

        Destructor.
    */
    destroy: function () {
        NS.RootViewController.removeResponder( this );
    },
    
    /**
        Method: O.GlobalKeyboardShortcuts#register
        
        Add a global keyboard shortcut. If a shortcut has already been
        registered for this key, it will be replaced.
        
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
        this._shortcuts[ key ] = [ object, method ];
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
        var current = this._shortcuts[ key ];
        if ( current && current[0] === object && current[1] === method ) {
            delete this._shortcuts[ key ];
        }
        return this;
    },
    
    /**
        Method (private): O.GlobalKeyboardShortcuts#_trigger
        
        Keypress event handler. Triggers any registered callback.
        
        Parameters:
            event - {DOMEvent} The keypress event.
   */
    _trigger: function ( event ) {
        var key = NS.DOMEvent.lookupKey( event ),
            handler = this._shortcuts[ key ];
        if ( handler && this.get( 'isEnabled' ) ) {
            handler[0][ handler[1] ]( event );
            event.preventDefault();
        }
    }.on( 'keypress' )
});

NS.GlobalKeyboardShortcuts = GlobalKeyboardShortcuts;

}( O ) );
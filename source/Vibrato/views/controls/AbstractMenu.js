// -------------------------------------------------------------------------- \\
// File: AbstractMenu.js                                                      \\
// Module: View                                                               \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

NS.AbstractMenu = {
    items: [],
    filterValue: '',
    filterItem: function ( item, pattern ) {},
    isItemHidden: function ( item ) { return false; },
    didBlurItem: function ( item ) {},
    didFocusItem: function ( item ) {},
    didSelectItem: function ( item ) {},
    getItemFromElement: function ( element ) { return null; },
    hide: function () {},

    // ---

    filterValueDidChange: function () {
        var value = this.get( 'filterValue' ).escapeRegExp(),
            pattern = new RegExp( '\\b' + value, 'i' ),
            items = this.get( 'items' ),
            l = items.get( 'length' );
        
        while ( l-- ) {
            this.filterItem( items.getObjectAt( l ), pattern );
        }
        if ( !this._am_focussed || this.isItemHidden( this._am_focussed ) ) {
            this.focusNext();
        }
    }.observes( 'filterValue' ),

    getAdjacentItem: function ( step ) {
        var items = this.get( 'items' ),
            l = items.get( 'length' ),
            i = ( ( items.indexOf( this._am_focussed ) + 1 ) ||
                  ( step > 0 ? l : 1 )
                ) - 1,
            current = i;
        do {
            i = ( i + step ).mod( l );
        } while ( this.isItemHidden( items.getObjectAt( i ) ) &&
            i !== current );
        return items.getObjectAt( i );
    },

    focusPrevious: function () {
        this.focusItem( this.getAdjacentItem( -1 ) );
    },

    focusNext: function () {
        this.focusItem( this.getAdjacentItem( 1 ) );
    },

    focusItem: function ( item ) {
        var current = this._am_focussed;
        if ( current === item ) { return; }
        if ( current ) {
            this.didBlurItem( current );
        }
        if ( !item || this.isItemHidden( item ) ) {
            this._am_focussed = null;
        } else {
            this.didFocusItem( this._am_focussed = item );
        }
    },

    selectFocussed: function () {
        var focussed = this._am_focussed;
        if ( focussed && !this.isItemHidden( focussed ) ) {
            this.didSelectItem( focussed );
        }
    },
    
    // Hide after event loop so that the keypress event is still routed to this
    // view. Otherwise it could activate a global keyboard shortcut.
    hideInNextEventLoop: function () {
        NS.RunLoop.invokeInNextEventLoop( this.hide, this );
    },
    
    _keyBindings: {
        esc: 'hideInNextEventLoop',
        enter: 'selectFocussed',
        up: 'focusPrevious',
        down: 'focusNext'
    },
    
    _triggerKeyBinding: function ( event ) {
        var key = NS.DOMEvent.lookupKey( event ),
            bindings = this._keyBindings;
        if ( bindings[ key ] ) {
            event.preventDefault();
            this[ bindings[ key ] ]( event, key );
        }
    }.on( 'keydown' ),
    
    _focusOnHover: function ( event ) {
        var item = this.getItemFromElement( event.target );
        if ( item ) {
            this.focusItem( item );
        }
    }.on( 'mouseover' ),
    _defocusOnLeave: function () {
        this.focusItem( null );
    }.on( 'mouseout' ),
    
    _selectClicked: function ( event ) {
        if ( NS.Element.contains( this.get( 'layer' ), event.target ) ) {
            var item = this.getItemFromElement( event.target );
            if ( item ) {
                this.focusItem( item );
                this.selectFocussed( event );
            }
        }
    }.on( 'mouseup' )
};

}( this.O ) );